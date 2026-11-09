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
--       the owner and staff, never someone the owner blocked, and otherwise
--       - public account  -> verified residents
--       - private account -> accepted followers, plus the people who already
--                            see the full profile row (shared verified
--                            neighborhood under the existing rules, and people
--                            who asked to follow them)
--   * social_profile / list_follows / list_follow_requests return a photo only
--     to viewers allowed to see it, and never the legacy public URL of a
--     private account to anyone else.
--   * Going private clears the legacy public URL from the profile row.
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

create or replace function private.can_view_profile_photo(owner uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select v.viewer is not null and (
    v.viewer = owner
    or private.is_admin_or_moderator()
    or (not private.is_blocked_between(v.viewer, owner) and (
      private.profile_visible(owner)
      or (private.is_verified_resident(v.viewer)
          and not coalesce((select p.is_private from public.profiles p where p.id = owner and p.deleted_at is null), true))
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

-- Going private: drop the legacy public URL so it is never handed out again
-- (the app moves the photo itself into private storage first).
create or replace function private.clear_public_avatar_when_private()
returns trigger language plpgsql security invoker set search_path to '' as $$
begin
  if new.is_private and new.avatar_url is not null and new.avatar_url like '%/storage/v1/object/public/avatars/%' then
    new.avatar_url := null;
  end if;
  return new;
end; $$;
create trigger profiles_private_clears_public_avatar before insert or update of is_private, avatar_url on public.profiles
  for each row execute function private.clear_public_avatar_when_private();

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
revoke all on function private.can_view_profile_photo_folder(text) from public, anon;
revoke all on function private.clear_public_avatar_when_private() from public, anon;
revoke all on function private.guard_comment_update() from public, anon;
grant execute on function private.can_view_profile_photo(uuid), private.can_view_profile_photo_folder(text),
  private.clear_public_avatar_when_private(), private.guard_comment_update() to authenticated;
revoke all on function public.list_follows(uuid, text, text, integer, integer) from public, anon;
revoke all on function public.list_follow_requests() from public, anon;
grant execute on function public.list_follows(uuid, text, text, integer, integer), public.list_follow_requests() to authenticated;
