-- Neighbors (الجيران): mutual connections, opt-in discovery, interests,
-- privacy settings, activity/club invitations, and messaging that requires an
-- accepted connection (or an existing authorized context).
--
-- Applied to project ckqwziutmqohihrenstz via the Supabase MCP on 2026-10-14
-- and verified with supabase/tests/neighbors.sql (rolled back).

-- ------------------------------------------------------------- settings --
-- Separate from profiles because profiles are readable by every verified
-- neighbor; these settings are readable only by their owner. Defaults are
-- privacy-preserving: NOT discoverable, no neighbor count, no shared clubs.
create table if not exists public.neighbor_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  discoverable boolean not null default false,
  allow_requests boolean not null default true,
  show_neighbor_count boolean not null default false,
  show_interests boolean not null default true,
  show_shared_clubs boolean not null default false,
  allow_neighbor_messages boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.neighbor_settings enable row level security;
create policy neighbor_settings_select_own on public.neighbor_settings for select using (user_id = (select auth.uid()));
revoke all on public.neighbor_settings from anon, authenticated;
grant select on public.neighbor_settings to authenticated;

create or replace function private.neighbor_setting(target uuid, setting text)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select coalesce((select case setting
      when 'discoverable' then s.discoverable
      when 'allow_requests' then s.allow_requests
      when 'show_neighbor_count' then s.show_neighbor_count
      when 'show_interests' then s.show_interests
      when 'show_shared_clubs' then s.show_shared_clubs
      when 'allow_neighbor_messages' then s.allow_neighbor_messages
    end from public.neighbor_settings s where s.user_id = target),
    -- Defaults when the resident never opened the settings.
    case setting when 'allow_requests' then true when 'show_interests' then true when 'allow_neighbor_messages' then true else false end);
$fn$;

-- ------------------------------------------------------------ interests --
create table if not exists public.profile_interests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  interest text not null check (interest = any (array[
    'football','padel','running','cycling','walking','fitness','gaming','reading','coffee','volunteering','photography','technology'])),
  created_at timestamptz not null default now(),
  primary key (user_id, interest)
);
alter table public.profile_interests enable row level security;
create policy profile_interests_select on public.profile_interests for select using (
  user_id = (select auth.uid())
  or ((select private.shares_verified_neighborhood(user_id)) and (select private.neighbor_setting(user_id, 'show_interests'))));
revoke all on public.profile_interests from anon, authenticated;
grant select on public.profile_interests to authenticated;

-- ---------------------------------------------------------- connections --
create table if not exists public.neighbor_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);
-- At most one open request per pair, in either direction.
create unique index if not exists neighbor_requests_one_pending
  on public.neighbor_requests (least(requester_id, recipient_id), greatest(requester_id, recipient_id)) where status = 'pending';
create index if not exists neighbor_requests_recipient_idx on public.neighbor_requests (recipient_id, status);
create index if not exists neighbor_requests_requester_idx on public.neighbor_requests (requester_id, created_at desc);
alter table public.neighbor_requests enable row level security;
create policy neighbor_requests_select_party on public.neighbor_requests for select using (
  requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));
revoke all on public.neighbor_requests from anon, authenticated;
grant select on public.neighbor_requests to authenticated;

-- One row per connected pair (user_a < user_b): no duplicates, no direction.
create table if not exists public.neighbor_connections (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists neighbor_connections_b_idx on public.neighbor_connections (user_b);
alter table public.neighbor_connections enable row level security;
-- Private: you only ever see your own connections.
create policy neighbor_connections_select_own on public.neighbor_connections for select using (
  user_a = (select auth.uid()) or user_b = (select auth.uid()));
revoke all on public.neighbor_connections from anon, authenticated;
grant select on public.neighbor_connections to authenticated;

create or replace function private.are_neighbors(a uuid, b uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists (select 1 from public.neighbor_connections c where c.user_a = least(a, b) and c.user_b = greatest(a, b));
$fn$;

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists (select 1 from public.user_blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$fn$;

-- ---------------------------------------------------------- invitations --
create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, invitee_id),
  check (inviter_id <> invitee_id)
);
alter table public.event_invitations enable row level security;
create policy event_invitations_select_party on public.event_invitations for select using (
  inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));
revoke all on public.event_invitations from anon, authenticated;
grant select on public.event_invitations to authenticated;

create table if not exists public.club_invitations (
  club_id uuid not null references public.community_groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, invitee_id),
  check (inviter_id <> invitee_id)
);
alter table public.club_invitations enable row level security;
create policy club_invitations_select_party on public.club_invitations for select using (
  inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));
revoke all on public.club_invitations from anon, authenticated;
grant select on public.club_invitations to authenticated;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'reply','thanks','event_reminder','issue_update','help_response','message','alert','marketplace_inquiry',
  'group_activity','referral','moderation','neighbor_request','neighbor_accepted','event_invite','club_invite']));


-- Soft removal keeps the schema free of hard deletes: a removed connection is
-- kept with removed_at set and revived on a new accepted request.
alter table public.neighbor_connections add column if not exists removed_at timestamptz;
alter policy neighbor_connections_select_own on public.neighbor_connections using (
  removed_at is null and (user_a = (select auth.uid()) or user_b = (select auth.uid())));
create or replace function private.are_neighbors(a uuid, b uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists (select 1 from public.neighbor_connections c where c.user_a = least(a, b) and c.user_b = greatest(a, b) and c.removed_at is null);
$fn$;

-- Interests as one array per resident (profile_interests above is superseded
-- and unused; see 20261014110000_pending_owner_approval.sql to remove it).
create table if not exists public.user_interests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  interests text[] not null default '{}' check (interests <@ array[
    'football','padel','running','cycling','walking','fitness','gaming','reading','coffee','volunteering','photography','technology']::text[]
    and coalesce(array_length(interests, 1), 0) <= 12),
  updated_at timestamptz not null default now()
);
alter table public.user_interests enable row level security;
create policy user_interests_select on public.user_interests for select using (
  user_id = (select auth.uid())
  or ((select private.shares_verified_neighborhood(user_id)) and (select private.neighbor_setting(user_id, 'show_interests'))));
revoke all on public.user_interests from anon, authenticated;
grant select on public.user_interests to authenticated;

-- ---------------------------------------------------- profile visibility --
-- Before: every verified neighbor could list every profile in the
-- neighborhood (a de-facto directory). Now a neighbor's profile is readable
-- only when there is a reason: they opted into discovery, you are connected or
-- have a pending request, you share a conversation or club, or they have
-- public activity in the neighborhood (a post, comment, event, listing...)
-- whose author is already visible. Registering alone never lists you.
create or replace function private.profile_visible(target uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
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
$fn$;

alter policy profiles_select on public.profiles using ((select private.profile_visible(id)));

-- ------------------------------------------------------------- settings --
create or replace function public.update_neighbor_settings(p jsonb)
returns public.neighbor_settings language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); result public.neighbor_settings;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  insert into public.neighbor_settings(user_id) values (caller) on conflict (user_id) do nothing;
  update public.neighbor_settings set
    discoverable = coalesce((p->>'discoverable')::boolean, discoverable),
    allow_requests = coalesce((p->>'allow_requests')::boolean, allow_requests),
    show_neighbor_count = coalesce((p->>'show_neighbor_count')::boolean, show_neighbor_count),
    show_interests = coalesce((p->>'show_interests')::boolean, show_interests),
    show_shared_clubs = coalesce((p->>'show_shared_clubs')::boolean, show_shared_clubs),
    allow_neighbor_messages = coalesce((p->>'allow_neighbor_messages')::boolean, allow_neighbor_messages),
    updated_at = now()
  where user_id = caller returning * into result;
  return result;
end; $fn$;

create or replace function public.set_my_interests(interests text[])
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  insert into public.user_interests(user_id, interests, updated_at)
  values (caller, array(select distinct i from unnest(coalesce(interests, '{}')) i order by 1), now())
  on conflict (user_id) do update set interests = excluded.interests, updated_at = now();
end; $fn$;

-- ---------------------------------------------------------- connections --
create or replace function private.neighbor_state(me uuid, target uuid)
returns text language sql stable security definer set search_path to '' as $fn$
  select case
    when me = target then 'self'
    when exists (select 1 from public.user_blocks where blocker_id = me and blocked_id = target) then 'blocked'
    when private.are_neighbors(me, target) then 'connected'
    when exists (select 1 from public.neighbor_requests where requester_id = me and recipient_id = target and status = 'pending') then 'request_sent'
    when exists (select 1 from public.neighbor_requests where requester_id = target and recipient_id = me and status = 'pending') then 'request_received'
    else 'none' end;
$fn$;

create or replace function public.send_neighbor_request(target uuid)
returns text language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); st text; recent int; to_target int; who text;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if target is null or target = caller then raise exception 'invalid target' using errcode = '22023'; end if;
  if not private.shares_verified_neighborhood(target)
     or not exists (select 1 from public.profiles where id = target and deleted_at is null) then
    raise exception 'not_verified' using errcode = '42501';
  end if;
  -- A block in either direction looks the same as "unavailable" to the sender.
  if private.is_blocked_between(caller, target) then raise exception 'unavailable' using errcode = '42501'; end if;
  st := private.neighbor_state(caller, target);
  if st in ('connected', 'request_sent', 'request_received') then return st; end if;
  if not private.neighbor_setting(target, 'allow_requests') then raise exception 'requests_closed' using errcode = '42501'; end if;
  select count(*) into recent from public.neighbor_requests where requester_id = caller and created_at > now() - interval '24 hours';
  select count(*) into to_target from public.neighbor_requests where requester_id = caller and recipient_id = target
    and (created_at > now() - interval '30 days' and status in ('declined', 'cancelled'));
  if recent >= 20 or to_target >= 2 then raise exception 'rate_limited' using errcode = '22023'; end if;
  insert into public.neighbor_requests(requester_id, recipient_id) values (caller, target);
  select coalesce(nullif(trim(first_name), ''), 'جار') into who from public.profiles where id = caller;
  perform private.notify(target, caller, 'neighbor_request', 'طلب جار جديد', 'New neighbor request',
    who || ' يرغب بإضافتك كجار.', who || ' would like to add you as a neighbor.', '/neighbors?tab=requests');
  return 'request_sent';
end; $fn$;

create or replace function public.cancel_neighbor_request(target uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
begin
  update public.neighbor_requests set status = 'cancelled', responded_at = now()
  where requester_id = (select auth.uid()) and recipient_id = target and status = 'pending';
end; $fn$;

-- Only the recipient can accept; acceptance is never inferred from a request.
create or replace function public.respond_neighbor_request(request uuid, accept boolean)
returns text language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); r public.neighbor_requests; who text;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into r from public.neighbor_requests where id = request for update;
  if r.id is null or r.recipient_id <> caller then raise exception 'not_authorized' using errcode = '42501'; end if;
  if r.status <> 'pending' then return r.status; end if;
  if not accept then
    update public.neighbor_requests set status = 'declined', responded_at = now() where id = r.id;
    return 'declined';
  end if;
  if private.is_blocked_between(caller, r.requester_id) or not private.shares_verified_neighborhood(r.requester_id) then
    raise exception 'unavailable' using errcode = '42501';
  end if;
  update public.neighbor_requests set status = 'accepted', responded_at = now() where id = r.id;
  insert into public.neighbor_connections(user_a, user_b) values (least(caller, r.requester_id), greatest(caller, r.requester_id))
  on conflict (user_a, user_b) do update set removed_at = null, created_at = now();
  select coalesce(nullif(trim(first_name), ''), 'جار') into who from public.profiles where id = caller;
  perform private.notify(r.requester_id, caller, 'neighbor_accepted', 'أصبحتما جيراناً', 'You are now neighbors',
    who || ' قبل طلبك.', who || ' accepted your request.', '/profile/' || caller);
  return 'accepted';
end; $fn$;

create or replace function public.remove_neighbor(target uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.neighbor_connections set removed_at = now()
  where user_a = least(caller, target) and user_b = greatest(caller, target) and removed_at is null;
end; $fn$;

-- Blocking ends the connection, open requests and pending invitations at once.
create or replace function private.on_user_block()
returns trigger language plpgsql security definer set search_path to '' as $fn$
begin
  update public.neighbor_connections set removed_at = now()
  where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id) and removed_at is null;
  update public.neighbor_requests set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((requester_id = new.blocker_id and recipient_id = new.blocked_id) or (requester_id = new.blocked_id and recipient_id = new.blocker_id));
  update public.event_invitations set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((inviter_id = new.blocker_id and invitee_id = new.blocked_id) or (inviter_id = new.blocked_id and invitee_id = new.blocker_id));
  return new;
end; $fn$;
create trigger user_blocks_neighbor_cleanup after insert on public.user_blocks for each row execute function private.on_user_block();

-- ------------------------------------------------------------- discovery --
create or replace function private.shared_interests(a uuid, b uuid)
returns text[] language sql stable security definer set search_path to '' as $fn$
  select coalesce(array(select x from unnest((select interests from public.user_interests where user_id = a)) x
    where x = any (coalesce((select interests from public.user_interests where user_id = b), '{}')) order by 1), '{}');
$fn$;

create or replace function private.mutual_neighbor_count(a uuid, b uuid)
returns int language sql stable security definer set search_path to '' as $fn$
  select count(*)::int from public.neighbor_connections c1
  where c1.removed_at is null and (c1.user_a = a or c1.user_b = a)
    and private.are_neighbors(case when c1.user_a = a then c1.user_b else c1.user_a end, b);
$fn$;

-- Only residents who opted in, in the caller's verified neighborhood. Names
-- respect name_privacy (search never matches a hidden last name).
create or replace function public.discover_neighbors(search text default null, max_results int default 50)
returns table(user_id uuid, first_name text, last_name text, avatar_url text, bio text, shared_interests text[], mutual_count int, state text)
language plpgsql stable security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); nb text; q text := nullif(lower(trim(coalesce(search, ''))), '');
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select neighborhood_id into nb from public.neighborhood_memberships where neighborhood_memberships.user_id = caller and active and verification_status = 'verified';
  if nb is null then return; end if;
  return query
  select p.id, p.first_name,
    case p.name_privacy when 'full' then p.last_name when 'first_last_initial' then left(p.last_name, 1) else '' end,
    p.avatar_url, p.bio,
    case when private.neighbor_setting(p.id, 'show_interests') then private.shared_interests(caller, p.id) else '{}'::text[] end,
    case when private.neighbor_setting(p.id, 'show_neighbor_count') then private.mutual_neighbor_count(caller, p.id) end,
    private.neighbor_state(caller, p.id)
  from public.profiles p
  join public.neighborhood_memberships m on m.user_id = p.id and m.neighborhood_id = nb and m.active and m.verification_status = 'verified'
  where p.id <> caller and p.deleted_at is null and p.profile_completed
    and private.neighbor_setting(p.id, 'discoverable')
    and not private.is_blocked_between(caller, p.id)
    and (q is null or lower(p.first_name) like '%' || q || '%' or (p.name_privacy = 'full' and lower(p.last_name) like '%' || q || '%'))
  order by p.first_name
  limit least(greatest(coalesce(max_results, 50), 1), 100);
end; $fn$;

-- What the caller may know about one neighbor's connections, interests and clubs.
create or replace function public.neighbor_profile(target uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); st text; req uuid; show_count boolean;
begin
  if caller is null or not private.profile_visible(target) then return null; end if;
  st := private.neighbor_state(caller, target);
  select id into req from public.neighbor_requests where requester_id = target and recipient_id = caller and status = 'pending';
  show_count := target = caller or private.neighbor_setting(target, 'show_neighbor_count');
  return jsonb_build_object(
    'state', st,
    'incoming_request_id', req,
    'accepts_requests', private.neighbor_setting(target, 'allow_requests'),
    'neighbor_count', case when show_count then (select count(*) from public.neighbor_connections where removed_at is null and (user_a = target or user_b = target)) end,
    'mutual_count', case when show_count and target <> caller then private.mutual_neighbor_count(caller, target) end,
    'shared_interests', case when target <> caller and private.neighbor_setting(target, 'show_interests') then to_jsonb(private.shared_interests(caller, target)) else '[]'::jsonb end,
    'shared_clubs', case when target = caller or private.neighbor_setting(target, 'show_shared_clubs') then
      coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name)) from public.community_groups g
        where g.review_status = 'approved' and g.deleted_at is null
          and exists (select 1 from public.group_members a where a.group_id = g.id and a.user_id = caller and a.status = 'active')
          and exists (select 1 from public.group_members b where b.group_id = g.id and b.user_id = target and b.status = 'active')), '[]'::jsonb)
      else '[]'::jsonb end,
    'can_message', st = 'connected' and private.neighbor_setting(target, 'allow_neighbor_messages') and not private.is_blocked_between(caller, target));
end; $fn$;

-- -------------------------------------------------------------- messaging --
-- A new direct conversation needs an accepted connection (and the other
-- resident allowing neighbor messages) or a concrete context the other
-- resident created (their activity, listing, help request, borrow item or
-- lost & found post). Existing threads keep working. A request alone never
-- grants messaging.
create or replace function public.start_direct_conversation(other_user_id uuid, context_type text default null, context_id uuid default null)
returns public.conversations language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); existing public.conversations; created public.conversations; allowed boolean := false;
begin
  if caller is null then raise exception 'authentication required' using errcode='42501'; end if;
  if caller = other_user_id then raise exception 'cannot message yourself' using errcode='23514'; end if;
  if not private.shares_verified_neighborhood(other_user_id) then raise exception 'users do not share a verified neighborhood' using errcode='42501'; end if;
  if private.is_blocked_between(caller, other_user_id) then raise exception 'conversation unavailable' using errcode='42501'; end if;
  select c.* into existing from public.conversations c
    join public.conversation_members a on a.conversation_id=c.id and a.user_id=caller and a.left_at is null
    join public.conversation_members b on b.conversation_id=c.id and b.user_id=other_user_id and b.left_at is null
    where c.kind='direct' and (select count(*) from public.conversation_members cm where cm.conversation_id=c.id and cm.left_at is null)=2
    limit 1;
  if existing.id is not null then return existing; end if;

  if private.are_neighbors(caller, other_user_id) and private.neighbor_setting(other_user_id, 'allow_neighbor_messages') then
    allowed := true;
  elsif context_type = 'event' then
    allowed := exists (select 1 from public.events e where e.id = context_id and e.host_id = other_user_id and e.deleted_at is null
      and private.is_verified_neighborhood_member(e.neighborhood_id));
  elsif context_type = 'listing' then
    allowed := exists (select 1 from public.marketplace_listings l where l.id = context_id and l.seller_id = other_user_id and l.deleted_at is null
      and private.is_verified_neighborhood_member(l.neighborhood_id));
  elsif context_type = 'help' then
    allowed := exists (select 1 from public.help_requests h where h.id = context_id and h.requester_id = other_user_id and h.deleted_at is null
      and private.is_verified_neighborhood_member(h.neighborhood_id));
  elsif context_type = 'borrow' then
    allowed := exists (select 1 from public.borrow_listings b where b.id = context_id and b.owner_id = other_user_id and b.deleted_at is null
      and private.is_verified_neighborhood_member(b.neighborhood_id));
  elsif context_type = 'lost_found' then
    allowed := exists (select 1 from public.lost_found_posts f where f.id = context_id and f.author_id = other_user_id and f.deleted_at is null
      and private.is_verified_neighborhood_member(f.neighborhood_id));
  end if;
  if not allowed then raise exception 'not_connected' using errcode='42501'; end if;

  insert into public.conversations(kind,created_by) values('direct',caller) returning * into created;
  insert into public.conversation_members(conversation_id,user_id) values(created.id,caller),(created.id,other_user_id);
  return created;
end;
$fn$;

-- Kept for older app builds: same signature, now requires a connection.
create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns public.conversations language sql security definer set search_path to '' as $fn$
  select * from public.start_direct_conversation(other_user_id, null, null);
$fn$;

-- Blocked pairs can no longer write in their direct thread; club chats keep their approval rule.
create or replace function private.conversation_writable(target_conversation uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select coalesce((select case
    when c.group_id is not null then coalesce((select g.review_status = 'approved' and g.deleted_at is null from public.community_groups g where g.id = c.group_id), false)
    when c.kind = 'direct' then not exists (
      select 1 from public.conversation_members a join public.conversation_members b on b.conversation_id = a.conversation_id and b.user_id <> a.user_id
      where a.conversation_id = c.id and private.is_blocked_between(a.user_id, b.user_id))
    else true end
  from public.conversations c where c.id = target_conversation), true);
$fn$;

-- ------------------------------------------------------------ invitations --
create or replace function public.invite_neighbors_to_event(target_event uuid, invitees uuid[])
returns int language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); e public.events; inv uuid; added int := 0; recent int; rows_added int; who text;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into e from public.events where id = target_event and deleted_at is null;
  if e.id is null or e.cancelled_at is not null or e.starts_at <= now() or not private.is_verified_neighborhood_member(e.neighborhood_id) then
    raise exception 'event unavailable' using errcode = '22023';
  end if;
  if coalesce(array_length(invitees, 1), 0) > 50 then raise exception 'invalid:invitees' using errcode = '22023'; end if;
  select count(*) into recent from public.event_invitations where inviter_id = caller and created_at > now() - interval '24 hours';
  if recent + coalesce(array_length(invitees, 1), 0) > 100 then raise exception 'rate_limited' using errcode = '22023'; end if;
  select coalesce(nullif(trim(first_name), ''), 'جار') into who from public.profiles where id = caller;
  foreach inv in array coalesce(invitees, '{}') loop
    -- Only connected neighbors who could actually join; ineligible ids are skipped, never enrolled.
    continue when inv = caller or not private.are_neighbors(caller, inv) or private.is_blocked_between(caller, inv);
    continue when not exists (select 1 from public.neighborhood_memberships m where m.user_id = inv and m.neighborhood_id = e.neighborhood_id and m.active and m.verification_status = 'verified');
    continue when exists (select 1 from public.event_attendees a where a.event_id = e.id and a.user_id = inv and a.status in ('going','waitlisted'));
    continue when e.members_only and not exists (select 1 from public.group_members g where g.group_id = e.club_id and g.user_id = inv and g.status = 'active');
    insert into public.event_invitations(event_id, inviter_id, invitee_id) values (e.id, caller, inv)
    on conflict (event_id, invitee_id) do update set inviter_id = excluded.inviter_id, status = 'pending', created_at = now(), responded_at = null
      where public.event_invitations.status = 'cancelled';
    get diagnostics rows_added = row_count;
    if rows_added > 0 then
      added := added + 1;
      perform private.notify(inv, caller, 'event_invite', 'دعوة لفعالية', 'Activity invitation',
        who || ' يدعوك إلى «' || e.title || '».', who || ' invited you to "' || e.title || '".', '/event/' || e.id);
    end if;
  end loop;
  return added;
end; $fn$;

create or replace function public.respond_event_invitation(invitation uuid, accept boolean)
returns text language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); i public.event_invitations;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into i from public.event_invitations where id = invitation for update;
  if i.id is null or i.invitee_id <> caller then raise exception 'not_authorized' using errcode = '42501'; end if;
  if i.status <> 'pending' then return i.status; end if;
  if accept then
    -- The invitee's own explicit RSVP, with every normal eligibility check.
    perform public.rsvp_event(i.event_id, 'going');
  end if;
  update public.event_invitations set status = case when accept then 'accepted' else 'declined' end, responded_at = now() where id = i.id;
  return case when accept then 'accepted' else 'declined' end;
end; $fn$;

create or replace function public.cancel_event_invitation(invitation uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
begin
  update public.event_invitations set status = 'cancelled', responded_at = now()
  where id = invitation and inviter_id = (select auth.uid()) and status = 'pending';
end; $fn$;

create or replace function public.invite_neighbor_to_club(target_club uuid, invitee uuid)
returns boolean language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups; rows_added int; who text; recent int;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null;
  if g.id is null or g.review_status <> 'approved' or not private.is_active_group_member(g.id) then raise exception 'club_unavailable' using errcode = '42501'; end if;
  if not private.are_neighbors(caller, invitee) or private.is_blocked_between(caller, invitee) then raise exception 'not_connected' using errcode = '42501'; end if;
  if not exists (select 1 from public.neighborhood_memberships m where m.user_id = invitee and m.neighborhood_id = g.neighborhood_id and m.active and m.verification_status = 'verified') then
    raise exception 'not_verified' using errcode = '42501';
  end if;
  if exists (select 1 from public.group_members where group_id = g.id and user_id = invitee and status in ('active','pending','banned')) then return false; end if;
  select count(*) into recent from public.club_invitations where inviter_id = caller and created_at > now() - interval '24 hours';
  if recent >= 50 then raise exception 'rate_limited' using errcode = '22023'; end if;
  insert into public.club_invitations(club_id, inviter_id, invitee_id) values (g.id, caller, invitee) on conflict do nothing;
  get diagnostics rows_added = row_count;
  if rows_added = 0 then return false; end if;
  select coalesce(nullif(trim(first_name), ''), 'جار') into who from public.profiles where id = caller;
  perform private.notify(invitee, caller, 'club_invite', 'دعوة لنادٍ', 'Club invitation',
    who || ' يدعوك للانضمام إلى «' || g.name || '».', who || ' invited you to join "' || g.name || '".', '/clubs/' || g.id);
  return true;
end; $fn$;

do $grants$
declare f text;
begin
  foreach f in array array[
    'public.update_neighbor_settings(jsonb)', 'public.set_my_interests(text[])', 'public.send_neighbor_request(uuid)',
    'public.cancel_neighbor_request(uuid)', 'public.respond_neighbor_request(uuid,boolean)', 'public.remove_neighbor(uuid)',
    'public.discover_neighbors(text,integer)', 'public.neighbor_profile(uuid)', 'public.start_direct_conversation(uuid,text,uuid)',
    'public.get_or_create_direct_conversation(uuid)', 'public.invite_neighbors_to_event(uuid,uuid[])',
    'public.respond_event_invitation(uuid,boolean)', 'public.cancel_event_invitation(uuid)', 'public.invite_neighbor_to_club(uuid,uuid)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $grants$;
revoke truncate, trigger, references on public.neighbor_settings, public.user_interests, public.profile_interests, public.neighbor_requests,
  public.neighbor_connections, public.event_invitations, public.club_invitations from authenticated, anon;
