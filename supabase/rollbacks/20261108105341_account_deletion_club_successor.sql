-- Restores the previous function body and retains its permissions.
-- It cannot recover rows removed by a past account deletion.
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
    select id from public.community_groups where owner_id = target_user_id
  loop
    select user_id into replacement_owner
    from public.group_members
    where group_id = owned_group.id
      and user_id <> target_user_id
      and status = 'active'
    order by joined_at
    limit 1;

    if replacement_owner is null then
      delete from public.community_groups where id = owned_group.id;
    else
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
$function$;
