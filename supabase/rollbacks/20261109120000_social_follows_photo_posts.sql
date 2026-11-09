-- Rollback for 20261109120000_social_follows_photo_posts.sql. Run after the
-- 20261109130000 rollback. Requires owner approval.
--
-- Data safety: before anything is dropped, the social data is copied into the
-- private schema (no client access), so re-applying the migration later can
-- bring it back with supabase/rollbacks/restore_20261109_social_data.sql:
--   private.rollback_20261109_follows          every follow and pending request
--   private.rollback_20261109_privacy          who had a private account
--   private.rollback_20261109_post_audiences   posts that used public/followers
--   private.rollback_20261109_notifications    follow notifications
-- While rolled back, posts that used 'public' or 'followers' become
-- 'neighborhood' (the strictest existing audience), so nothing becomes more
-- visible. Their photos stay in community-media/posts/<uid>/ and are
-- readable only by their authors and staff until the migration is re-applied.
begin;
-- Appends on a repeated rollback; the restore script ignores duplicates.
create table if not exists private.rollback_20261109_follows as
  select f.*, now() as saved_at from public.follows f limit 0;
insert into private.rollback_20261109_follows select f.*, now() as saved_at from public.follows f;
-- Appends on a repeated rollback; the restore script ignores duplicates.
create table if not exists private.rollback_20261109_privacy as
  select id as user_id, is_private, now() as saved_at from public.profiles where is_private limit 0;
insert into private.rollback_20261109_privacy select id as user_id, is_private, now() as saved_at from public.profiles where is_private;
-- Appends on a repeated rollback; the restore script ignores duplicates.
create table if not exists private.rollback_20261109_post_audiences as
  select id as post_id, audience, now() as saved_at from public.posts where audience in ('public', 'followers') limit 0;
insert into private.rollback_20261109_post_audiences select id as post_id, audience, now() as saved_at from public.posts where audience in ('public', 'followers');
-- Appends on a repeated rollback; the restore script ignores duplicates.
create table if not exists private.rollback_20261109_notifications as
  select n.*, now() as saved_at from public.notifications n where n.type in ('follow', 'follow_request', 'follow_accepted') limit 0;
insert into private.rollback_20261109_notifications select n.*, now() as saved_at from public.notifications n where n.type in ('follow', 'follow_request', 'follow_accepted');
revoke all on private.rollback_20261109_follows, private.rollback_20261109_privacy,
  private.rollback_20261109_post_audiences, private.rollback_20261109_notifications from public, anon, authenticated;
drop trigger if exists posts_guard_write on public.posts;
drop trigger if exists profiles_privacy_change on public.profiles;
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_neighborhood on public.posts as permissive for select to authenticated
  using ((deleted_at is null) and ((select private.is_admin_or_moderator()) or (select private.is_verified_neighborhood_member(posts.neighborhood_id))));
drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments as permissive for select to authenticated
  using ((deleted_at is null) and (select private.can_access_post(post_comments.post_id)));
drop policy if exists community_media_insert_post_photo on storage.objects;
drop policy if exists community_media_select_post_photo on storage.objects;
update public.posts set audience = 'neighborhood' where audience in ('public', 'followers');
alter table public.posts drop constraint posts_audience_check;
alter table public.posts add constraint posts_audience_check check (audience = any (array['neighborhood'::text, 'city'::text]));
alter table public.posts drop constraint if exists posts_image_count_check;
drop index if exists public.posts_image_paths_gin;
delete from public.notifications where type in ('follow', 'follow_request', 'follow_accepted');
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['reply'::text, 'thanks'::text, 'event_reminder'::text, 'issue_update'::text, 'help_response'::text, 'message'::text, 'alert'::text, 'marketplace_inquiry'::text, 'group_activity'::text, 'referral'::text, 'moderation'::text, 'neighbor_request'::text, 'neighbor_accepted'::text, 'event_invite'::text, 'club_invite'::text])));
CREATE OR REPLACE FUNCTION private.can_access_post(target_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.posts p
    where p.id = target_post_id and p.deleted_at is null
      and ((select private.is_admin_or_moderator()) or (select private.is_verified_neighborhood_member(p.neighborhood_id)))
  );
$function$
;

CREATE OR REPLACE FUNCTION private.profile_visible(target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select target = (select auth.uid())
    or private.is_admin_or_moderator()
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
    ));
$function$
;

CREATE OR REPLACE FUNCTION private.notify_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.notifications(user_id,actor_id,type,title_ar,title_en,body_ar,body_en,deep_link)
  select p.author_id,new.author_id,'reply','تعليق جديد','New comment',left(new.body,160),left(new.body,160),'/post/'||new.post_id
  from public.posts p where p.id=new.post_id and p.author_id<>new.author_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.notify_post_reaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.notifications(user_id,actor_id,type,title_ar,title_en,body_ar,body_en,deep_link)
  select p.author_id,new.user_id,'thanks','تفاعل جديد','New reaction','تفاعل أحد الجيران مع منشورك','A neighbor reacted to your post','/post/'||new.post_id
  from public.posts p where p.id=new.post_id and p.author_id<>new.user_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.on_user_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.neighbor_connections set removed_at = now()
  where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id) and removed_at is null;
  update public.neighbor_requests set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((requester_id = new.blocker_id and recipient_id = new.blocked_id) or (requester_id = new.blocked_id and recipient_id = new.blocker_id));
  update public.event_invitations set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((inviter_id = new.blocker_id and invitee_id = new.blocked_id) or (inviter_id = new.blocked_id and invitee_id = new.blocker_id));
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.purge_account_data(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  delete from public.profiles where id = target_user_id;
end;
$function$
;

drop function if exists public.social_profile(uuid);
drop function if exists public.follow_user(uuid);
drop function if exists public.unfollow_user(uuid);
drop function if exists public.respond_follow_request(uuid, boolean);
drop function if exists public.remove_follower(uuid);
drop function if exists public.set_account_private(boolean);
drop function if exists public.list_follows(uuid, text, text, integer, integer);
drop function if exists public.list_follow_requests();
drop function if exists public.delete_post_comment(uuid);
drop function if exists public.delete_post(uuid);
drop function if exists private.on_profile_privacy_change();
drop function if exists private.guard_post_write();
drop function if exists private.can_read_post_photo(text);
drop function if exists private.can_view_post(uuid, text, text);
drop function if exists private.follow_state(uuid, uuid);
drop function if exists private.masked_last_name(text, text);
drop table if exists public.follows;
drop function if exists private.is_accepted_follower(uuid, uuid);
drop function if exists private.is_verified_resident(uuid);
alter table public.profiles drop column if exists is_private;
revoke all on function public.purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_data(uuid) to service_role;
commit;
