-- =============================================================================
-- Haratna social profiles: follows, private accounts, per-post audiences and
-- multi-photo posts.
--
-- STATUS: NOT APPLIED TO PRODUCTION. Requires the owner's explicit approval.
-- Tested against a schema-only local replica (supabase/tests/social_follows.sql).
-- Rollback: supabase/rollbacks/20261109120000_social_follows_photo_posts.sql
--
-- What it changes
--   * profiles.is_private          (default false: nothing changes for anyone
--                                   until they switch it on)
--   * follows                      (writes only through the RPCs below)
--   * posts.audience               adds 'public' and 'followers'; 'neighborhood'
--                                  stays the default ("Verified neighbors")
--   * posts read policy            -> private.can_view_post (audience, follows,
--                                  blocks); neighborhood-only content stays
--                                  limited to verified members
--   * post photos                  new private prefix community-media/posts/<uid>/
--                                  readable only by people who can view a post
--                                  that references the photo
--   * comments                     hidden between blocked users; post authors
--                                  can remove comments on their own posts
--   * notifications                adds follow / follow_request / follow_accepted;
--                                  existing like/comment notifications skip
--                                  blocked pairs
--   * account deletion             also removes notifications the account caused
--                                  (follows, likes, comments cascade already)
-- =============================================================================

-- ---------------------------------------------------------------- privacy --
alter table public.profiles add column if not exists is_private boolean not null default false;

-- ---------------------------------------------------------------- follows --
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id),
  constraint follows_accepted_at check ((status = 'accepted') = (accepted_at is not null))
);
create index follows_followee_status_idx on public.follows (followee_id, status, created_at desc);
create index follows_follower_status_idx on public.follows (follower_id, status, created_at desc);

alter table public.follows enable row level security;
-- Both sides of a relationship can see it; lists for everyone else go through
-- list_follows(), which applies the private-account rule.
create policy follows_select_own on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()) or (select private.is_admin_or_moderator()));
revoke all on public.follows from anon, authenticated;
grant select on public.follows to authenticated;
grant all on public.follows to service_role;

create or replace function private.is_accepted_follower(viewer uuid, author uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.follows f where f.follower_id = viewer and f.followee_id = author and f.status = 'accepted');
$$;

create or replace function private.is_verified_resident(target uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.neighborhood_memberships m
                 where m.user_id = target and m.active and m.verification_status = 'verified');
$$;

-- ------------------------------------------------------------------ posts --
alter table public.posts drop constraint posts_audience_check;
alter table public.posts add constraint posts_audience_check
  check (audience = any (array['neighborhood', 'city', 'public', 'followers']));
alter table public.posts add constraint posts_image_count_check check (cardinality(image_paths) <= 10);
create index if not exists posts_image_paths_gin on public.posts using gin (image_paths);
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);

/**
 * The single rule for who may see a post.
 *   neighborhood / city (legacy) -> verified members of the post's neighborhood
 *   followers                    -> accepted followers
 *   public                       -> verified members of the neighborhood, accepted
 *                                   followers, and - when the author's account is
 *                                   not private - any verified Haratna resident
 * Authors and staff always can; a block in either direction always hides it.
 */
create or replace function private.can_view_post(author uuid, post_neighborhood text, post_audience text)
returns boolean language sql stable security definer set search_path to '' as $$
  select v.viewer is not null and (
    v.viewer = author
    or private.is_admin_or_moderator()
    or (not private.is_blocked_between(v.viewer, author) and (
      (post_audience in ('neighborhood', 'city') and private.is_verified_neighborhood_member(post_neighborhood))
      or (post_audience = 'followers' and private.is_accepted_follower(v.viewer, author))
      or (post_audience = 'public' and (
        private.is_verified_neighborhood_member(post_neighborhood)
        or private.is_accepted_follower(v.viewer, author)
        or (private.is_verified_resident(v.viewer)
            and not coalesce((select p.is_private from public.profiles p where p.id = author), true))))
    )))
  from (select (select auth.uid()) as viewer) v;
$$;

create or replace function private.can_access_post(target_post_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.posts p
    where p.id = target_post_id and p.deleted_at is null
      and private.can_view_post(p.author_id, p.neighborhood_id, p.audience)
  );
$$;

drop policy posts_select_neighborhood on public.posts;
create policy posts_select_visible on public.posts for select to authenticated
  using (deleted_at is null and (select private.can_view_post(posts.author_id, posts.neighborhood_id, posts.audience)));

/**
 * Photo paths must point at the author's own uploads, so a post can never be
 * used to expose somebody else's private photo through the storage policy.
 * Edits can reorder or remove photos but not add them, and the post can't be
 * moved to another author or neighborhood.
 */
-- Security invoker on purpose: current_user is 'authenticated' only for a
-- direct API write, and the definer role inside trusted RPCs (create_poll).
create or replace function private.guard_post_write()
returns trigger language plpgsql security invoker set search_path to '' as $$
declare
  path text;
  parts text[];
  staff boolean := private.is_admin_or_moderator();
  client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'UPDATE' and client and not staff then
    if (new.author_id, new.neighborhood_id, new.type, new.created_at, new.linked_entity_type, new.linked_entity_id, new.pinned)
       is distinct from (old.author_id, old.neighborhood_id, old.type, old.created_at, old.linked_entity_type, old.linked_entity_id, old.pinned) then
      raise exception 'invalid:post_fields' using errcode = '42501';
    end if;
    if not (new.image_paths <@ old.image_paths) then
      raise exception 'invalid:images' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'INSERT' or new.image_paths is distinct from old.image_paths or new.audience is distinct from old.audience then
    foreach path in array new.image_paths loop
      parts := string_to_array(path, '/');
      if tg_op = 'INSERT' or client then
        if array_length(parts, 1) <> 3 or parts[2] <> new.author_id::text
           or not (parts[1] = 'posts' or parts[1] = new.neighborhood_id) then
          raise exception 'invalid:images' using errcode = '22023';
        end if;
      end if;
      -- Photos in the neighborhood folder are readable by every verified member,
      -- so they may only appear on neighborhood-audience posts.
      if new.audience in ('public', 'followers') and parts[1] <> 'posts' then
        raise exception 'invalid:audience' using errcode = '22023';
      end if;
    end loop;
  end if;
  return new;
end; $$;

create trigger posts_guard_write before insert or update on public.posts
  for each row execute function private.guard_post_write();

-- ---------------------------------------------------------------- storage --
create or replace function private.can_read_post_photo(object_name text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.posts p
    where p.image_paths @> array[object_name] and p.deleted_at is null
      and private.can_view_post(p.author_id, p.neighborhood_id, p.audience)
  );
$$;

-- Uploads go to posts/<uid>/<file>; only verified residents may upload.
create policy community_media_insert_post_photo on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = ((select auth.uid()))::text
    and (select private.is_verified_resident((select auth.uid())))
  );
-- Read: the uploader, staff, or someone who can view a post that uses the photo.
create policy community_media_select_post_photo on storage.objects for select to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = 'posts'
    and ((storage.foldername(name))[2] = ((select auth.uid()))::text
         or (select private.is_platform_admin())
         or private.can_read_post_photo(name))
  );

-- --------------------------------------------------------------- comments --
drop policy comments_select on public.post_comments;
create policy comments_select on public.post_comments for select to authenticated
  using (deleted_at is null
         and (select private.can_access_post(post_comments.post_id))
         and not private.is_blocked_between((select auth.uid()), post_comments.author_id));

/** Removes a comment: its author, the post's author (moderating their post), or staff. */
create or replace function public.delete_post_comment(target_comment uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare caller uuid := (select auth.uid()); c record;
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select pc.id, pc.author_id, p.author_id as post_author into c
  from public.post_comments pc join public.posts p on p.id = pc.post_id
  where pc.id = target_comment and pc.deleted_at is null;
  if c.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if caller <> c.author_id and caller <> c.post_author and not private.is_admin_or_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.post_comments set deleted_at = now() where id = target_comment;
end; $$;

-- ---------------------------------------------------------- notifications --
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'reply', 'thanks', 'event_reminder', 'issue_update', 'help_response', 'message', 'alert', 'marketplace_inquiry',
  'group_activity', 'referral', 'moderation', 'neighbor_request', 'neighbor_accepted', 'event_invite', 'club_invite',
  'follow', 'follow_request', 'follow_accepted']));

create or replace function private.notify_comment()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.notifications(user_id,actor_id,type,title_ar,title_en,body_ar,body_en,deep_link)
  select p.author_id,new.author_id,'reply','تعليق جديد','New comment',left(new.body,160),left(new.body,160),'/post/'||new.post_id
  from public.posts p where p.id=new.post_id and p.author_id<>new.author_id
    and not private.is_blocked_between(p.author_id, new.author_id);
  return new;
end; $$;

create or replace function private.notify_post_reaction()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.notifications(user_id,actor_id,type,title_ar,title_en,body_ar,body_en,deep_link)
  select p.author_id,new.user_id,'thanks','تفاعل جديد','New reaction','تفاعل أحد الجيران مع منشورك','A neighbor reacted to your post','/post/'||new.post_id
  from public.posts p where p.id=new.post_id and p.author_id<>new.user_id
    and not private.is_blocked_between(p.author_id, new.user_id);
  return new;
end; $$;

-- ---------------------------------------------------------------- profile --
/**
 * Full profile rows stay neighborhood-scoped (profile_visible). This adds:
 *   - people who follow you (or asked to) are visible to you
 *   - people you follow (accepted) are visible to you
 *   - authors of public posts by non-private accounts are visible to verified residents
 * and hides you from anyone you have blocked.
 */
create or replace function private.profile_visible(target uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select target = (select auth.uid())
    or private.is_admin_or_moderator()
    or (
      not exists (select 1 from public.user_blocks ub where ub.blocker_id = target and ub.blocked_id = (select auth.uid()))
      and (
        exists (select 1 from public.follows f where f.follower_id = target and f.followee_id = (select auth.uid()))
        or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = target and f.status = 'accepted')
        or (exists (select 1 from public.posts p where p.author_id = target and p.audience = 'public' and p.deleted_at is null)
            and not coalesce((select pr.is_private from public.profiles pr where pr.id = target), true)
            and private.is_verified_resident((select auth.uid())))
        or (private.shares_verified_neighborhood(target) and (
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
        ))
      )
    );
$$;

create or replace function private.masked_last_name(last_name text, name_privacy text)
returns text language sql immutable set search_path to '' as $$
  select case name_privacy when 'full' then last_name
                           when 'first_last_initial' then left(last_name, 1)
                           else '' end;
$$;

create or replace function private.follow_state(viewer uuid, target uuid)
returns text language sql stable security definer set search_path to '' as $$
  select case when viewer = target then 'self'
              else coalesce((select case f.status when 'accepted' then 'following' else 'requested' end
                             from public.follows f where f.follower_id = viewer and f.followee_id = target), 'none') end;
$$;

/**
 * The profile header anyone with the id may see (like a public profile card):
 * name (respecting name privacy), photo, verified badge and counts. Bio,
 * interests and neighborhood follow the existing profile_visible rule. Returns
 * null when the person has blocked the caller or the account is gone.
 */
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

-- ------------------------------------------------------------ follow RPCs --
create or replace function public.follow_user(target uuid)
returns text language plpgsql security definer set search_path to '' as $$
declare caller uuid := (select auth.uid()); private_account boolean; existing text;
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if target is null or target = caller then raise exception 'invalid:self' using errcode = '22023'; end if;
  if not private.is_verified_resident(caller) then raise exception 'not_verified' using errcode = '42501'; end if;
  select is_private into private_account from public.profiles where id = target and deleted_at is null;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
  if private.is_blocked_between(caller, target) then raise exception 'blocked' using errcode = '42501'; end if;

  select status into existing from public.follows where follower_id = caller and followee_id = target;
  if existing is not null then return case existing when 'accepted' then 'following' else 'requested' end; end if;

  if (select count(*) from public.follows where follower_id = caller and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.follows(follower_id, followee_id, status, accepted_at)
  values (caller, target, case when private_account then 'pending' else 'accepted' end, case when private_account then null else now() end);

  -- One notification per relationship: re-following never stacks alerts.
  delete from public.notifications where user_id = target and actor_id = caller and type in ('follow', 'follow_request');
  if private_account then
    perform private.notify(target, caller, 'follow_request', 'طلب متابعة جديد', 'New follow request',
      'يرغب أحد السكان بمتابعتك', 'A resident asked to follow you', '/profile/' || caller);
    return 'requested';
  end if;
  perform private.notify(target, caller, 'follow', 'متابع جديد', 'New follower',
    'بدأ أحد السكان بمتابعتك', 'A resident started following you', '/profile/' || caller);
  return 'following';
end; $$;

/** Unfollows, or withdraws a pending request. */
create or replace function public.unfollow_user(target uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  delete from public.follows where follower_id = caller and followee_id = target;
  delete from public.notifications where user_id = target and actor_id = caller and type = 'follow_request';
end; $$;

create or replace function public.respond_follow_request(requester uuid, accept boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from public.follows where follower_id = requester and followee_id = caller and status = 'pending') then
    raise exception 'not_found' using errcode = '22023';
  end if;
  delete from public.notifications where user_id = caller and actor_id = requester and type = 'follow_request';
  if not accept then
    delete from public.follows where follower_id = requester and followee_id = caller;
    return;
  end if;
  update public.follows set status = 'accepted', accepted_at = now() where follower_id = requester and followee_id = caller;
  perform private.notify(requester, caller, 'follow_accepted', 'تم قبول طلب المتابعة', 'Follow request accepted',
    'يمكنك الآن رؤية منشوراته', 'You can now see their posts', '/profile/' || caller);
end; $$;

create or replace function public.remove_follower(follower uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  delete from public.follows where follower_id = follower and followee_id = caller;
  delete from public.notifications where user_id = caller and actor_id = follower and type in ('follow', 'follow_request');
end; $$;

/** Switching privacy. Going public approves everyone who is waiting. */
create or replace function public.set_account_private(make_private boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  update public.profiles set is_private = make_private where id = caller and deleted_at is null;
end; $$;

create or replace function private.on_profile_privacy_change()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted', accepted_at = now() where followee_id = new.id and status = 'pending';
    update public.notifications set type = 'follow', title_ar = 'متابع جديد', title_en = 'New follower',
      body_ar = 'بدأ أحد السكان بمتابعتك', body_en = 'A resident started following you'
    where user_id = new.id and type = 'follow_request';
  end if;
  return new;
end; $$;
create trigger profiles_privacy_change after update of is_private on public.profiles
  for each row execute function private.on_profile_privacy_change();

/**
 * Followers / following of a profile, searchable by the names people show.
 * Others' lists are hidden for private accounts unless you follow them.
 */
create or replace function public.list_follows(target uuid, kind text, search text default null, lim integer default 50, off integer default 0)
returns table(user_id uuid, first_name text, last_name text, name_privacy text, avatar_url text, is_private boolean, verified boolean, follow_state text, created_at timestamptz)
language plpgsql stable security definer set search_path to '' as $$
declare caller uuid := (select auth.uid()); q text := nullif(btrim(coalesce(search, '')), '');
begin
  if caller is null or kind not in ('followers', 'following') then return; end if;
  if caller <> target and not private.is_admin_or_moderator() then
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

create or replace function public.list_follow_requests()
returns table(user_id uuid, first_name text, last_name text, name_privacy text, avatar_url text, verified boolean, created_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.id, p.first_name, private.masked_last_name(p.last_name, p.name_privacy), p.name_privacy, p.avatar_url,
         private.is_verified_resident(p.id), f.created_at
  from public.follows f join public.profiles p on p.id = f.follower_id
  where f.followee_id = (select auth.uid()) and f.status = 'pending' and p.deleted_at is null
  order by f.created_at desc limit 200;
$$;

-- ------------------------------------------------------------------ blocks --
create or replace function private.on_user_block()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  update public.neighbor_connections set removed_at = now()
  where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id) and removed_at is null;
  update public.neighbor_requests set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((requester_id = new.blocker_id and recipient_id = new.blocked_id) or (requester_id = new.blocked_id and recipient_id = new.blocker_id));
  update public.event_invitations set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((inviter_id = new.blocker_id and invitee_id = new.blocked_id) or (inviter_id = new.blocked_id and invitee_id = new.blocker_id));
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.notifications
  where type in ('follow', 'follow_request', 'follow_accepted')
    and ((user_id = new.blocker_id and actor_id = new.blocked_id) or (user_id = new.blocked_id and actor_id = new.blocker_id));
  return new;
end; $$;

-- --------------------------------------------------------- account deletion --
-- follows, post_reactions, saved_posts and comment_reactions cascade with the
-- profile; photos are removed by the delete-account function via
-- media_attachments. This also removes the notifications the account caused.
create or replace function public.purge_account_data(target_user_id uuid)
returns void language plpgsql security definer set search_path to '' as $function$
declare
  owned_group record;
  replacement_owner uuid;
  owned_conversation record;
  replacement_creator uuid;
begin
  if target_user_id is null then
    raise exception 'target user is required' using errcode = '22023';
  end if;

  for owned_group in
    select id from public.community_groups where owner_id = target_user_id order by id for update
  loop
    select user_id into replacement_owner
    from public.group_members
    where group_id = owned_group.id
      and user_id <> target_user_id
      and status = 'active'
      and private.is_adult(user_id)
    order by (role = 'moderator') desc, joined_at, user_id
    limit 1
    for update;

    if replacement_owner is null then
      delete from public.community_groups where id = owned_group.id;
    else
      update public.group_members
      set role = 'owner'
      where group_id = owned_group.id and user_id = replacement_owner;
      update public.conversation_members cm
      set role = 'owner'
      from public.conversations c
      where c.group_id = owned_group.id and c.id = cm.conversation_id
        and cm.user_id = replacement_owner and cm.left_at is null;
      update public.community_groups
      set owner_id = replacement_owner, updated_at = now()
      where id = owned_group.id;
    end if;
  end loop;

  for owned_conversation in
    select id from public.conversations where created_by = target_user_id
  loop
    select user_id into replacement_creator
    from public.conversation_members
    where conversation_id = owned_conversation.id
      and user_id <> target_user_id
      and left_at is null
    order by joined_at
    limit 1;

    if replacement_creator is null then
      delete from public.conversations where id = owned_conversation.id;
    else
      update public.conversations
      set created_by = replacement_creator, updated_at = now()
      where id = owned_conversation.id;
    end if;
  end loop;

  delete from public.moderation_actions where moderator_id = target_user_id;
  delete from public.reports where reporter_id = target_user_id;
  delete from public.community_alerts where created_by = target_user_id;
  delete from public.institution_content where author_id = target_user_id;
  delete from public.issue_updates where author_id = target_user_id;
  delete from public.messages where sender_id = target_user_id;
  delete from public.business_recommendations where author_id = target_user_id;
  delete from public.borrow_listings where owner_id = target_user_id;
  delete from public.marketplace_listings where seller_id = target_user_id;
  delete from public.lost_found_posts where author_id = target_user_id;
  delete from public.help_requests where requester_id = target_user_id;
  delete from public.issues where reporter_id = target_user_id;
  delete from public.events where host_id = target_user_id;
  delete from public.polls where creator_id = target_user_id;
  delete from public.post_comments where author_id = target_user_id;
  delete from public.posts where author_id = target_user_id;
  delete from public.notifications where actor_id = target_user_id;
  delete from public.follows where follower_id = target_user_id or followee_id = target_user_id;

  delete from public.profiles where id = target_user_id;
end;
$function$;

-- ------------------------------------------------------------------ grants --
revoke all on function private.can_view_post(uuid, text, text) from public, anon;
revoke all on function private.can_read_post_photo(text) from public, anon;
revoke all on function private.is_accepted_follower(uuid, uuid) from public, anon;
revoke all on function private.is_verified_resident(uuid) from public, anon;
revoke all on function private.follow_state(uuid, uuid) from public, anon;
revoke all on function private.guard_post_write() from public, anon;
grant execute on function private.guard_post_write() to authenticated;
grant execute on function private.can_view_post(uuid, text, text), private.can_read_post_photo(text),
  private.is_accepted_follower(uuid, uuid), private.is_verified_resident(uuid), private.follow_state(uuid, uuid) to authenticated;

revoke all on function public.social_profile(uuid) from public, anon;
revoke all on function public.follow_user(uuid) from public, anon;
revoke all on function public.unfollow_user(uuid) from public, anon;
revoke all on function public.respond_follow_request(uuid, boolean) from public, anon;
revoke all on function public.remove_follower(uuid) from public, anon;
revoke all on function public.set_account_private(boolean) from public, anon;
revoke all on function public.list_follows(uuid, text, text, integer, integer) from public, anon;
revoke all on function public.list_follow_requests() from public, anon;
revoke all on function public.delete_post_comment(uuid) from public, anon;
grant execute on function public.social_profile(uuid), public.follow_user(uuid), public.unfollow_user(uuid),
  public.respond_follow_request(uuid, boolean), public.remove_follower(uuid), public.set_account_private(boolean),
  public.list_follows(uuid, text, text, integer, integer), public.list_follow_requests(), public.delete_post_comment(uuid)
  to authenticated;
revoke all on function public.purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_data(uuid) to service_role;
