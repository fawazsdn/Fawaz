-- Haratna v1.1 — poll vote changes, activities, map coordinates,
-- neighborhood stats, event notifications, realtime.
--
-- Strictly additive (no DROP statements): existing rows are untouched except
-- the polls.allow_change backfill, so polls created before this migration
-- also let residents change their vote. RLS stays enabled everywhere; the
-- only policy change narrows poll_votes visibility to the voter's own row.
-- Applied to project ckqwziutmqohihrenstz on 2026-10-12.

-- 1. Polls: one active vote per user, changeable until the poll closes ------
alter table public.polls alter column allow_change set default true;
update public.polls set allow_change = true where not allow_change;
alter table public.polls add column if not exists total_votes integer not null default 0;

create or replace function private.refresh_poll_total()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare target uuid := coalesce(new.poll_id, old.poll_id);
begin
  update public.polls set total_votes = (select count(*) from public.poll_votes v where v.poll_id = target) where id = target;
  return null;
end;
$fn$;

create trigger poll_votes_refresh_total after insert or update or delete on public.poll_votes
for each row execute function private.refresh_poll_total();

-- Who voted for what is private; neighbors see aggregate counts only.
alter policy poll_votes_select on public.poll_votes using (user_id = (select auth.uid()));

create or replace function public.get_poll_results(target_poll_ids uuid[])
returns table (poll_id uuid, option_id uuid, vote_count bigint)
language sql stable security definer set search_path to '' as $fn$
  select o.poll_id, o.id, count(v.user_id)
    from public.poll_options o left join public.poll_votes v on v.option_id = o.id
   where o.poll_id = any(target_poll_ids) and private.can_access_poll(o.poll_id)
   group by o.poll_id, o.id;
$fn$;
revoke all on function public.get_poll_results(uuid[]) from public, anon;
grant execute on function public.get_poll_results(uuid[]) to authenticated;

-- Atomic vote/change: the (poll_id, user_id) primary key guarantees one row
-- per voter; a change moves that row to the new option in place.
create or replace function public.vote_in_poll(target_poll_id uuid, target_option_id uuid)
returns public.poll_votes language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); result public.poll_votes; poll_row public.polls;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into poll_row from public.polls where id = target_poll_id for update;
  if not found then raise exception 'poll not found' using errcode = 'P0002'; end if;
  if poll_row.closes_at <= now() then raise exception 'poll is closed' using errcode = '22023'; end if;
  if not private.is_verified_neighborhood_member(poll_row.neighborhood_id) then
    raise exception 'neighborhood access denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.poll_options where id = target_option_id and poll_id = target_poll_id) then
    raise exception 'option does not belong to poll' using errcode = '23503';
  end if;
  insert into public.poll_votes (poll_id, option_id, user_id) values (target_poll_id, target_option_id, caller)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, created_at = now() where poll_row.allow_change
  returning * into result;
  if result is null then raise exception 'vote already recorded' using errcode = '23505'; end if;
  return result;
end;
$fn$;
revoke all on function public.vote_in_poll(uuid, uuid) from public, anon;
grant execute on function public.vote_in_poll(uuid, uuid) to authenticated;

-- 2. Activities reuse the events system ------------------------------------
alter table public.events add column if not exists kind text not null default 'event'
  constraint events_kind_check check (kind in ('event', 'activity'));
alter table public.events add column if not exists occasion text
  constraint events_occasion_check check (occasion is null or occasion in ('national_day', 'founding_day', 'ramadan', 'eid', 'festival'));
alter table public.events add constraint events_approx_coords_check check (
  (approx_lat is null and approx_lng is null) or (approx_lat between -90 and 90 and approx_lng between -180 and 180));
create index if not exists events_neighborhood_starts_idx on public.events (neighborhood_id, starts_at) where deleted_at is null;

-- 3. Opt-in approximate map coordinates ------------------------------------
alter table public.businesses add column if not exists approx_lat double precision;
alter table public.businesses add column if not exists approx_lng double precision;
alter table public.businesses add constraint businesses_approx_coords_check check (
  (approx_lat is null and approx_lng is null) or (approx_lat between -90 and 90 and approx_lng between -180 and 180));
alter table public.posts add column if not exists approx_lat double precision;
alter table public.posts add column if not exists approx_lng double precision;
alter table public.posts add column if not exists location_label text;
alter table public.posts add constraint posts_approx_coords_check check (
  (approx_lat is null and approx_lng is null) or (approx_lat between -90 and 90 and approx_lng between -180 and 180));

-- 4. Aggregate neighborhood stats (counts only, no row data) ----------------
create or replace function public.neighborhood_stats(target_neighborhood_id text)
returns table (residents bigint, events_this_week bigint, open_issues bigint, helpful_actions bigint)
language sql stable security definer set search_path to '' as $fn$
  select
    (select count(*) from public.neighborhood_memberships m
      where m.neighborhood_id = target_neighborhood_id and m.active and m.verification_status = 'verified'),
    (select count(*) from public.events e
      where e.neighborhood_id = target_neighborhood_id and e.deleted_at is null and e.cancelled_at is null
        and e.starts_at >= now() and e.starts_at < now() + interval '7 days'),
    (select count(*) from public.issues i
      where i.neighborhood_id = target_neighborhood_id and i.deleted_at is null and i.status <> 'resolved'),
    (select count(*) from public.help_request_responses r
      join public.help_requests h on h.id = r.help_request_id
      where h.neighborhood_id = target_neighborhood_id and h.deleted_at is null);
$fn$;
revoke all on function public.neighborhood_stats(text) from public, anon;
grant execute on function public.neighborhood_stats(text) to authenticated;

-- 5. Real notifications for event participation ----------------------------
create or replace function private.notify_event_attendance()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare ev public.events;
begin
  select * into ev from public.events where id = new.event_id;
  if ev.id is null then return new; end if;
  if new.status = 'going' and new.user_id <> ev.host_id
     and (tg_op = 'INSERT' or old.status is distinct from 'going') then
    insert into public.notifications(user_id, actor_id, type, title_ar, title_en, body_ar, body_en, deep_link)
    values (ev.host_id, new.user_id, 'group_activity', 'مشارك جديد', 'New participant',
            'انضم أحد الجيران إلى "' || left(ev.title, 80) || '"',
            'A neighbor joined "' || left(ev.title, 80) || '"', '/event/' || ev.id);
  end if;
  if tg_op = 'UPDATE' and old.status = 'waitlisted' and new.status = 'going' then
    insert into public.notifications(user_id, actor_id, type, title_ar, title_en, body_ar, body_en, deep_link)
    values (new.user_id, null, 'event_reminder', 'تأكد مكانك', 'You''re in',
            'توفر لك مكان في "' || left(ev.title, 80) || '"',
            'A spot opened up for you in "' || left(ev.title, 80) || '"', '/event/' || ev.id);
  end if;
  return new;
end;
$fn$;
create trigger event_attendees_notify after insert or update on public.event_attendees
for each row execute function private.notify_event_attendance();

-- 6. Realtime (still filtered by each table's SELECT RLS per subscriber) ----
alter publication supabase_realtime add table public.polls, public.events, public.event_attendees, public.posts, public.conversations;
