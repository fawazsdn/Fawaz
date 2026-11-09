-- =============================================================================
-- Haratna: private profile photos + RLS hardening found in the PR #5 review.
--
-- STATUS: NOT APPLIED TO PRODUCTION. Requires the owner's explicit approval.
-- Depends on 20261109120000_social_follows_photo_posts.sql.
-- Tests:    supabase/tests/social_follows.sql, supabase/tests/private_profile_photos.sql
-- Rollback: supabase/rollbacks/20261109130000_private_profile_photos.sql
--
-- What it changes
--   * storage bucket `profile-photos` (private, 5 MB, images only). Photos are
--     served through short-lived signed URLs; the storage policy decides who
--     may create one.
--   * profiles.avatar_path: the photo's path in that bucket. Must live in the
--     account's own folder (<uid>/...).
--   * Who can see a profile photo (private.can_view_profile_photo):
--       the owner and staff, never across a block, never unverified accounts,
--       and otherwise
--       - public account  -> verified residents
--       - private account -> accepted followers, plus the people who already
--                            see the full profile under the neighborhood rule.
--       A pending follow request grants nothing, in either direction.
--   * social_profile / list_follows / list_follow_requests return a photo only
--     to viewers allowed to see it, and never the legacy public URL of a
--     private account to anyone else.
--   * Going private clears the legacy public URL from the profile row; every
--     public link taken off a profile is archived (private.avatar_legacy_urls)
--     and its file is kept until the owner approves the cleanup.
--   * Existing avatars: nothing is moved by this file. The copy is done by
--     scripts/migrate-avatars-to-private.mjs (dry run by default) and by the
--     app for each signed-in user; see docs/SOCIAL-MIGRATION-APPROVAL.md.
--   * Hardening: media_attachments rows are readable only by their owner and
--     staff (they used to be readable by the whole neighborhood, which listed
--     object paths of followers-only photos); a comment can't be moved to
--     another post or re-attributed by editing it.
-- =============================================================================

-- ---------------------------------------------------------------- bucket --
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.media_attachments drop constraint media_attachments_bucket_id_check;
alter table public.media_attachments add constraint media_attachments_bucket_id_check
  check (bucket_id = any (array['avatars', 'community-media', 'profile-photos']));

-- ---------------------------------------------------------------- profile --
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add constraint profiles_avatar_path_own_folder
  check (avatar_path is null or (split_part(avatar_path, '/', 1) = id::text and avatar_path !~ '\.\.' and char_length(avatar_path) <= 200));

/**
 * The pre-existing neighborhood rule for seeing someone's full profile
 * (shared verified neighborhood plus discoverability / connection / shared
 * activity), without the follow-related additions of 20261109120000.
 */
create or replace function private.profile_visible_in_neighborhood(target uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select private.shares_verified_neighborhood(target) and (
          private.neighbor_setting(target, 'discoverable')
          or private.are_neighbors((select auth.uid()), target)
          or exists (select 1 from public.neighbor_requests r where r.status = 'pending'
                     and ((r.requester_id = target and r.recipient_id = (select auth.uid())) or (r.recipient_id = target and r.requester_id = (select auth.uid()))))
          or exists (select 1 from public.conversation_members a join public.conversation_members b on b.conversation_id = a.conversation_id
                     where a.user_id = (select auth.uid()) and b.user_id = target)
          or exists (select 1 from public.group_members a join public.group_members b on b.group_id = a.group_id
                     where a.user_id = (select auth.uid()) and b.user_id = target and a.status = 'active' and b.status in ('active','pending'))
          or exists (select 1 from public.posts where author_id = target and deleted_at is null)
          or exists (select 1 from public.post_comments where author_id = target and deleted_at is null)
          or exists (select 1 from public.events where host_id = target and deleted_at is null)
          or exists (select 1 from public.event_attendees where user_id = target and status in ('going','waitlisted','interested'))
          or exists (select 1 from public.marketplace_listings where seller_id = target and deleted_at is null)
          or exists (select 1 from public.help_requests where requester_id = target and deleted_at is null)
          or exists (select 1 from public.help_request_responses where responder_id = target)
          or exists (select 1 from public.lost_found_posts where author_id = target and deleted_at is null)
          or exists (select 1 from public.issues where reporter_id = target and deleted_at is null)
          or exists (select 1 from public.borrow_listings where owner_id = target and deleted_at is null)
          or exists (select 1 from public.business_recommendations where author_id = target and deleted_at is null)
          or exists (select 1 from public.community_groups where owner_id = target and review_status = 'approved' and deleted_at is null)
        );
$$;

/**
 * Who may open a profile photo. A follow request on its own never grants
 * access - in either direction:
 *   owner / staff                -> always
 *   blocked either way           -> never
 *   public account               -> verified residents
 *   private account              -> accepted followers, and people who already
 *                                   see the profile under the neighborhood rule
 */
create or replace function private.can_view_profile_photo(owner uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select v.viewer is not null and (
    v.viewer = owner
    or private.is_admin_or_moderator()
    or (not private.is_blocked_between(v.viewer, owner) and private.is_verified_resident(v.viewer) and (
      not coalesce((select p.is_private from public.profiles p where p.id = owner and p.deleted_at is null), true)
      or private.is_accepted_follower(v.viewer, owner)
      or private.profile_visible_in_neighborhood(owner)
    )))
  from (select (select auth.uid()) as viewer) v;
$$;

-- Storage folder names are text; only real profile ids are considered.
create or replace function private.can_view_profile_photo_folder(folder text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.profiles p where p.id::text = folder and private.can_view_profile_photo(p.id));
$$;

create policy profile_photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = ((select auth.uid()))::text);
create policy profile_photos_update_own on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = ((select auth.uid()))::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = ((select auth.uid()))::text);
create policy profile_photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = ((select auth.uid()))::text);
create policy profile_photos_select_allowed on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and (
    (storage.foldername(name))[1] = ((select auth.uid()))::text
    or (select private.is_platform_admin())
    or private.can_view_profile_photo_folder((storage.foldername(name))[1])));

-- Legacy public photo links that were taken off a profile (account went
-- private, photo replaced or removed, or moved to private storage). The files
-- themselves stay in the public bucket until the owner approves the cleanup
-- (scripts/migrate-avatars-to-private.mjs --remove-public), so a rollback can
-- restore them. Private schema: no client can read it.
create table if not exists private.avatar_legacy_urls (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  reason text not null check (reason in ('went_private', 'replaced', 'removed', 'migrated')),
  archived_at timestamptz not null default now(),
  file_removed_at timestamptz
);
create index if not exists avatar_legacy_urls_user_idx on private.avatar_legacy_urls (user_id);
revoke all on private.avatar_legacy_urls from public, anon, authenticated;

create or replace function private.archive_public_avatar()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  -- Going private: never keep handing out a public link to the photo.
  if new.is_private and new.avatar_url is not null and new.avatar_url like '%/storage/v1/object/public/avatars/%' then
    insert into private.avatar_legacy_urls(user_id, url, reason) values (new.id, new.avatar_url, 'went_private');
    new.avatar_url := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.avatar_url is distinct from new.avatar_url
     and old.avatar_url like '%/storage/v1/object/public/avatars/%' then
    insert into private.avatar_legacy_urls(user_id, url, reason)
    values (new.id, old.avatar_url,
            case when new.avatar_url is null and new.avatar_path is not null and new.avatar_path is not distinct from old.avatar_path then 'migrated'
                 when new.avatar_url is null and new.avatar_path is null then 'removed'
                 else 'replaced' end);
  end if;
  return new;
end; $$;
create trigger profiles_archive_public_avatar before insert or update of is_private, avatar_url, avatar_path on public.profiles
  for each row execute function private.archive_public_avatar();

/** Operator inventory of legacy public photo files (service role only). */
create or replace function public.legacy_avatar_inventory()
returns table(user_id uuid, url text, reason text, archive_id bigint, file_removed_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.id, p.avatar_url, 'current', null::bigint, null::timestamptz
  from public.profiles p where p.avatar_url like '%/storage/v1/object/public/avatars/%'
  union all
  select a.user_id, a.url, a.reason, a.id, a.file_removed_at from private.avatar_legacy_urls a;
$$;

create or replace function public.mark_legacy_avatar_removed(target_user uuid, file_url text)
returns void language sql security definer set search_path to '' as $$
  update private.avatar_legacy_urls set file_removed_at = now() where user_id = target_user and url = file_url and file_removed_at is null;
$$;

-- ------------------------------------------------- photo-aware read RPCs --
create or replace function public.social_profile(target uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  caller uuid := (select auth.uid());
  p public.profiles;
  full_view boolean;
  content boolean;
  photo boolean;
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
  photo := private.can_view_profile_photo(target);
  return jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'last_name', private.masked_last_name(p.last_name, p.name_privacy),
    'name_privacy', p.name_privacy,
    'avatar_url', case when photo then p.avatar_url end,
    'avatar_path', case when photo then p.avatar_path end,
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

drop function public.list_follows(uuid, text, text, integer, integer);
create function public.list_follows(target uuid, kind text, search text default null, lim integer default 50, off integer default 0)
returns table(user_id uuid, first_name text, last_name text, name_privacy text, avatar_url text, avatar_path text, is_private boolean, verified boolean, follow_state text, created_at timestamptz)
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
    select p.id, p.first_name, private.masked_last_name(p.last_name, p.name_privacy), p.name_privacy,
           case when private.can_view_profile_photo(p.id) then p.avatar_url end,
           case when private.can_view_profile_photo(p.id) then p.avatar_path end,
           p.is_private, private.is_verified_resident(p.id), private.follow_state(caller, p.id), f.created_at
    from public.follows f
    join public.profiles p on p.id = case when kind = 'followers' then f.follower_id else f.followee_id end
    where (case when kind = 'followers' then f.followee_id else f.follower_id end) = target
      and f.status = 'accepted' and p.deleted_at is null
      and not private.is_blocked_between(caller, p.id)
      and (q is null or (p.first_name || ' ' || private.masked_last_name(p.last_name, p.name_privacy)) ilike '%' || q || '%')
    order by f.created_at desc
    limit least(greatest(coalesce(lim, 50), 1), 100) offset greatest(coalesce(off, 0), 0);
end; $$;

drop function public.list_follow_requests();
create function public.list_follow_requests()
returns table(user_id uuid, first_name text, last_name text, name_privacy text, avatar_url text, avatar_path text, verified boolean, created_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.id, p.first_name, private.masked_last_name(p.last_name, p.name_privacy), p.name_privacy,
         case when private.can_view_profile_photo(p.id) then p.avatar_url end,
         case when private.can_view_profile_photo(p.id) then p.avatar_path end,
         private.is_verified_resident(p.id), f.created_at
  from public.follows f join public.profiles p on p.id = f.follower_id
  where f.followee_id = (select auth.uid()) and f.status = 'pending' and p.deleted_at is null
  order by f.created_at desc limit 200;
$$;

-- ------------------------------------------------------------- hardening --
-- media_attachments lists object paths; only the owner (and staff) need them.
drop policy media_select on public.media_attachments;
create policy media_select on public.media_attachments for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin_or_moderator()));

-- Editing a comment may change its text only (moderators may also soft-delete).
create or replace function private.guard_comment_update()
returns trigger language plpgsql security invoker set search_path to '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.post_id, new.author_id, new.parent_id, new.created_at) is distinct from (old.post_id, old.author_id, old.parent_id, old.created_at) then
    raise exception 'invalid:comment_fields' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger post_comments_guard_update before update on public.post_comments
  for each row execute function private.guard_comment_update();

-- ------------------------------------------------------------------ grants --
revoke all on function private.can_view_profile_photo(uuid) from public, anon;
revoke all on function private.profile_visible_in_neighborhood(uuid) from public, anon;
revoke all on function private.can_view_profile_photo_folder(text) from public, anon;
revoke all on function private.archive_public_avatar() from public, anon;
revoke all on function public.legacy_avatar_inventory() from public, anon, authenticated;
revoke all on function public.mark_legacy_avatar_removed(uuid, text) from public, anon, authenticated;
grant execute on function public.legacy_avatar_inventory(), public.mark_legacy_avatar_removed(uuid, text) to service_role;
revoke all on function private.guard_comment_update() from public, anon;
grant execute on function private.can_view_profile_photo(uuid), private.can_view_profile_photo_folder(text), private.profile_visible_in_neighborhood(uuid),
  private.archive_public_avatar(), private.guard_comment_update() to authenticated;
revoke all on function public.list_follows(uuid, text, text, integer, integer) from public, anon;
revoke all on function public.list_follow_requests() from public, anon;
grant execute on function public.list_follows(uuid, text, text, integer, integer), public.list_follow_requests() to authenticated;
