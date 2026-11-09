-- Rollback for 20261109130000_private_profile_photos.sql (run before rolling
-- back 20261109120000_social_follows_photo_posts.sql). Requires owner approval.
--
-- Data safety:
--   * No storage file is deleted. Private copies stay in `profile-photos`.
--   * avatar_path values are kept in private.rollback_20261109_avatar_paths.
--   * Profiles whose public link was archived (went private / moved) get it
--     back from private.avatar_legacy_urls, as long as the public file has not
--     been removed by the approved cleanup. The archive table is kept.
--   * People who only have a private photo (uploaded in the new build, or whose
--     public original was already cleaned up) would show initials. Run
--     `node scripts/migrate-avatars-to-private.mjs --restore-public --apply`
--     BEFORE this file to give them a public copy again; the check below
--     stops the rollback if anyone would lose their photo.
begin;
do $$
declare n int;
begin
  select count(*) into n from public.profiles p
  where p.avatar_path is not null and p.avatar_url is null
    and not exists (select 1 from private.avatar_legacy_urls a
                    where a.user_id = p.id and a.reason in ('went_private', 'migrated') and a.file_removed_at is null);
  if n > 0 and coalesce(current_setting('haratna.allow_photo_fallback', true), '') <> 'on' then
    raise exception 'rollback stopped: % profile(s) have only a private photo; run --restore-public first (or set haratna.allow_photo_fallback=on to accept initials)', n;
  end if;
end $$;
create table if not exists private.rollback_20261109_avatar_paths as
  select id as user_id, avatar_path, now() as saved_at from public.profiles where avatar_path is not null limit 0;
insert into private.rollback_20261109_avatar_paths select id, avatar_path, now() from public.profiles where avatar_path is not null;
revoke all on private.rollback_20261109_avatar_paths from public, anon, authenticated;
-- Drop the archiving trigger first, or it would clear the restored links again.
drop trigger if exists profiles_archive_public_avatar on public.profiles;
drop function if exists private.archive_public_avatar();
update public.profiles p set avatar_url = a.url
from (select distinct on (user_id) user_id, url from private.avatar_legacy_urls
      where reason in ('went_private', 'migrated') and file_removed_at is null
      order by user_id, archived_at desc) a
where p.id = a.user_id and p.avatar_url is null;
drop trigger if exists post_comments_guard_update on public.post_comments;
drop function if exists private.guard_comment_update();
drop policy if exists media_select on public.media_attachments;
create policy media_select on public.media_attachments as permissive for select to authenticated
  using ((owner_id = (select auth.uid())) or ((neighborhood_id is not null) and (select private.is_verified_neighborhood_member(media_attachments.neighborhood_id))) or (select private.is_admin_or_moderator()));

drop function if exists public.legacy_avatar_inventory();
drop function if exists public.mark_legacy_avatar_removed(uuid, text);
drop policy if exists profile_photos_insert_own on storage.objects;
drop policy if exists profile_photos_update_own on storage.objects;
drop policy if exists profile_photos_delete_own on storage.objects;
drop policy if exists profile_photos_select_allowed on storage.objects;

-- Restore the RPC signatures of 20261109120000 (no avatar_path column).
drop function if exists public.list_follows(uuid, text, text, integer, integer);
create function public.list_follows(target uuid, kind text, search text default null, lim integer default 50, off integer default 0)
returns table(user_id uuid, first_name text, last_name text, name_privacy text, avatar_url text, is_private boolean, verified boolean, follow_state text, created_at timestamptz)
language plpgsql stable security definer set search_path to '' as $$
declare caller uuid := (select auth.uid()); q text := nullif(btrim(coalesce(search, '')), '');
begin
  if caller is null or kind not in ('followers', 'following') then return; end if;
  if caller <> target and not private.is_admin_or_moderator() then
    if not private.is_verified_resident(caller) then return; end if;
    if private.is_blocked_between(caller, target) then return; end if;
    if coalesce((select p.is_private from public.profiles p where p.id = target and p.deleted_at is null), true)
       and not private.is_accepted_follower(caller, target) then return; end if;
  end if;
  return query
    select p.id, p.first_name, private.masked_last_name(p.last_name, p.name_privacy), p.name_privacy, p.avatar_url, p.is_private,
           private.is_verified_resident(p.id), private.follow_state(caller, p.id), f.created_at
    from public.follows f
    join public.profiles p on p.id = case when kind = 'followers' then f.follower_id else f.followee_id end
    where (case when kind = 'followers' then f.followee_id else f.follower_id end) = target
      and f.status = 'accepted' and p.deleted_at is null
      and not private.is_blocked_between(caller, p.id)
      and (q is null or (p.first_name || ' ' || private.masked_last_name(p.last_name, p.name_privacy)) ilike '%' || q || '%')
    order by f.created_at desc
    limit least(greatest(coalesce(lim, 50), 1), 100) offset greatest(coalesce(off, 0), 0);
end; $$;
drop function if exists public.list_follow_requests();
create function public.list_follow_requests()
returns table(user_id uuid, first_name text, last_name text, name_privacy text, avatar_url text, verified boolean, created_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.id, p.first_name, private.masked_last_name(p.last_name, p.name_privacy), p.name_privacy, p.avatar_url,
         private.is_verified_resident(p.id), f.created_at
  from public.follows f join public.profiles p on p.id = f.follower_id
  where f.followee_id = (select auth.uid()) and f.status = 'pending' and p.deleted_at is null
  order by f.created_at desc limit 200;
$$;
revoke all on function public.list_follows(uuid, text, text, integer, integer) from public, anon;
revoke all on function public.list_follow_requests() from public, anon;
grant execute on function public.list_follows(uuid, text, text, integer, integer), public.list_follow_requests() to authenticated;

create or replace function public.social_profile(target uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  caller uuid := (select auth.uid());
  p public.profiles;
  full_view boolean;
  content boolean;
  state text;
begin
  if caller is null then return null; end if;
  select * into p from public.profiles where id = target and deleted_at is null;
  if p.id is null then return null; end if;
  if caller <> target and exists (select 1 from public.user_blocks where blocker_id = target and blocked_id = caller) then return null; end if;
  -- Only verified residents (and staff) see other people's cards.
  if caller <> target and not private.is_verified_resident(caller) and not private.is_admin_or_moderator() then return null; end if;
  full_view := private.profile_visible(target);
  state := private.follow_state(caller, target);
  content := caller = target or private.is_admin_or_moderator() or not p.is_private or state = 'following';
  return jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'last_name', private.masked_last_name(p.last_name, p.name_privacy),
    'name_privacy', p.name_privacy,
    'avatar_url', p.avatar_url,
    'bio', case when full_view or content then p.bio end,
    'is_private', p.is_private,
    'verified', private.is_verified_resident(target),
    'neighborhood_id', case when full_view then (select m.neighborhood_id from public.neighborhood_memberships m
                                                  where m.user_id = target and m.active limit 1) end,
    'member_since', p.created_at,
    'posts_count', (select count(*) from public.posts po where po.author_id = target and po.deleted_at is null
                    and private.can_view_post(po.author_id, po.neighborhood_id, po.audience)),
    'followers_count', (select count(*) from public.follows f where f.followee_id = target and f.status = 'accepted'),
    'following_count', (select count(*) from public.follows f where f.follower_id = target and f.status = 'accepted'),
    'follow_state', state,
    'follows_you', exists (select 1 from public.follows f where f.follower_id = target and f.followee_id = caller and f.status = 'accepted'),
    'requested_you', exists (select 1 from public.follows f where f.follower_id = target and f.followee_id = caller and f.status = 'pending'),
    'can_view_content', content,
    'full_profile', full_view,
    'blocked_by_you', exists (select 1 from public.user_blocks where blocker_id = caller and blocked_id = target)
  );
end; $$;

drop function if exists private.can_view_profile_photo_folder(text);
drop function if exists private.can_view_profile_photo(uuid);
drop function if exists private.profile_visible_in_neighborhood(uuid);
alter table public.profiles drop constraint if exists profiles_avatar_path_own_folder;
alter table public.profiles drop column if exists avatar_path;
-- Keep the attachment records of private photos (account deletion still needs
-- them) by keeping the widened bucket check.
-- Kept on purpose: the profile-photos bucket (private, with its files),
-- private.avatar_legacy_urls and private.rollback_20261109_avatar_paths.
commit;
