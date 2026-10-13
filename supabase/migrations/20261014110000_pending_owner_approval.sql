-- NOT YET APPLIED — needs the owner's approval because it contains DELETE /
-- DROP statements (the Supabase tooling requires an explicit confirmation for
-- destructive SQL). Review, then run it in the Supabase SQL editor.
--
-- 1. Account deletion: clubs must never pass to a minor, and the successor must
--    get the owner role (today only owner_id changes). Clubs with no adult
--    successor are archived instead of hard-deleted, keeping other members'
--    history. Also removes the deleted user's club announcements.
-- 2. Drops the unused profile_interests table (superseded by user_interests).

-- ---------------------------------------------------- account deletion fix --
-- Clubs must never pass to a minor, and the new organizer gets the owner
-- role (not just owner_id). Clubs with no adult successor are archived, not
-- deleted, so other members' history is kept.
create or replace function public.purge_account_data(target_user_id uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare owned_group record; replacement_owner uuid; owned_conversation record; replacement_creator uuid;
begin
  if target_user_id is null then raise exception 'target user is required' using errcode = '22023'; end if;

  for owned_group in select id from public.community_groups where owner_id = target_user_id loop
    select gm.user_id into replacement_owner from public.group_members gm
    where gm.group_id = owned_group.id and gm.user_id <> target_user_id and gm.status = 'active' and private.is_adult(gm.user_id)
    order by (gm.role = 'moderator') desc, gm.joined_at limit 1;
    if replacement_owner is null then
      update public.community_groups set deleted_at = now(), updated_at = now() where id = owned_group.id;
      delete from public.group_members where group_id = owned_group.id and user_id = target_user_id;
    else
      update public.group_members set role = 'owner' where group_id = owned_group.id and user_id = replacement_owner;
      update public.community_groups set owner_id = replacement_owner, updated_at = now() where id = owned_group.id;
    end if;
  end loop;

  for owned_conversation in select id from public.conversations where created_by = target_user_id loop
    select user_id into replacement_creator from public.conversation_members
    where conversation_id = owned_conversation.id and user_id <> target_user_id and left_at is null order by joined_at limit 1;
    if replacement_creator is null then
      delete from public.conversations where id = owned_conversation.id;
    else
      update public.conversations set created_by = replacement_creator, updated_at = now() where id = owned_conversation.id;
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
  delete from public.club_announcements where author_id = target_user_id;
  -- Neighbor data, interests, settings, invitations, age declaration and
  -- memberships cascade from the profile row.
  delete from public.profiles where id = target_user_id;
end;
$fn$;
revoke all on function public.purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_data(uuid) to service_role;


drop table if exists public.profile_interests;
