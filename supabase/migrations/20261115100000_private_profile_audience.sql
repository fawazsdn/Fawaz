-- =============================================================================
-- Haratna: followers-only activity must not make an account discoverable.
--
-- STATUS: NOT APPLIED TO PRODUCTION. Requires the owner's explicit approval.
-- Depends on 20261109120000, 20261109130000 and 20261110090000.
-- Tests:    supabase/tests/private_profile_audience.sql
-- Rollback: supabase/rollbacks/20261115100000_private_profile_audience.sql
--
-- The neighborhood rule shows a resident's full profile (and, for a private
-- account, its profile photo) to verified neighbors when the resident takes part
-- in neighborhood life. Since 20261109120000 posts have audiences, so "has a
-- post" or "has a comment" also counted followers-only posts and comments on
-- them: one followers-only post made a private account visible to the whole
-- neighborhood. Now only activity neighbors can actually see counts:
--   * posts whose audience is not 'followers' (neighborhood, city, public);
--   * comments on such posts.
-- Every other branch is unchanged. Nothing else is altered; no data changes.
-- =============================================================================

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
          or exists (select 1 from public.posts where author_id = target and deleted_at is null and audience <> 'followers')
          or exists (select 1 from public.post_comments c join public.posts p on p.id = c.post_id
                     where c.author_id = target and c.deleted_at is null and p.deleted_at is null and p.audience <> 'followers')
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
          or exists (select 1 from public.posts where author_id = target and deleted_at is null and audience <> 'followers')
          or exists (select 1 from public.post_comments c join public.posts p on p.id = c.post_id
                     where c.author_id = target and c.deleted_at is null and p.deleted_at is null and p.audience <> 'followers')
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
