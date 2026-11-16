-- Rollback of 20261116163254_explore_social_feed: removes the Explore feed API and the
-- notification visibility policy. No data changes; hidden notifications become visible again.
begin;
drop policy if exists notifications_social_visibility on public.notifications;
drop function if exists public.explore_social_feed(text, integer, text);
commit;
