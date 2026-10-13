-- Clubs (الأندية), expanded activity categories and the club approval workflow.
--
-- Clubs reuse community_groups / group_members / group conversations (the existing
-- triggers create the club chat and revoke chat access when a membership stops
-- being active). Every write goes through SECURITY DEFINER RPCs; clients have no
-- insert/update policies on clubs or memberships. Only admin-approved clubs are
-- discoverable, joinable, or can host activities.
--
-- Applied to project ckqwziutmqohihrenstz via the Supabase MCP on 2026-10-13 and
-- verified with supabase/tests/clubs.sql (ALL_PASS, rolled back).

-- ---------------------------------------------------------------- events --
alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check check (category = any (array[
  'football','padel','basketball','volleyball','running','walking','cycling','fitness','hiking','swimming','tournaments',
  'coffee','family','kids','community','food','networking',
  'gaming','movies','arts','entertainment','celebrations',
  'cleanup','volunteering','education','markets','religious','outdoors','pets','iftar',
  'other']));
alter table public.events
  add column if not exists custom_category text,
  add column if not exists club_id uuid references public.community_groups(id) on delete set null,
  add column if not exists series_id uuid,
  add column if not exists recurrence text not null default 'none',
  add column if not exists members_only boolean not null default false;
alter table public.events
  add constraint events_custom_category_check check (custom_category is null or (btrim(custom_category) <> '' and char_length(custom_category) <= 40 and custom_category = btrim(custom_category))),
  add constraint events_custom_category_other_check check ((category = 'other') = (custom_category is not null)),
  add constraint events_recurrence_check check (recurrence = any (array['none','weekly','biweekly','monthly'])),
  add constraint events_members_only_club_check check (not members_only or club_id is not null);
create index if not exists events_club_idx on public.events (club_id) where deleted_at is null;
create index if not exists events_series_idx on public.events (series_id) where series_id is not null;

-- ------------------------------------------------------- community_groups --
alter table public.community_groups
  add column if not exists category text not null default 'other',
  add column if not exists custom_category text,
  add column if not exists cover_image_path text,
  add column if not exists logo_path text,
  add column if not exists membership_type text not null default 'approval',
  add column if not exists rules text not null default '',
  add column if not exists meeting_schedule text,
  add column if not exists purpose text not null default '',
  add column if not exists planned_activities text not null default '',
  add column if not exists meeting_frequency text not null default '',
  add column if not exists neighborhood_benefit text not null default '',
  add column if not exists meeting_location text,
  add column if not exists additional_info text,
  add column if not exists review_status text not null default 'pending_review',
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists inactivity_reminded_at timestamptz;
alter table public.community_groups
  add constraint community_groups_category_check check (category = any (array[
    'running','cycling','football','padel','basketball','volleyball','fitness','walking','hiking','swimming',
    'coffee','community','family','networking','food','travel',
    'photography','gaming','books','chess','art','music','technology','cars',
    'volunteering','environment','education','workshops','neighborhood_improvement','other'])),
  add constraint community_groups_custom_category_check check (((category = 'other') = (custom_category is not null))
    and (custom_category is null or (btrim(custom_category) <> '' and char_length(custom_category) <= 40 and custom_category = btrim(custom_category)))),
  add constraint community_groups_membership_type_check check (membership_type = any (array['open','approval'])),
  add constraint community_groups_rules_check check (char_length(rules) <= 3000),
  add constraint community_groups_schedule_check check (meeting_schedule is null or char_length(meeting_schedule) <= 200),
  add constraint community_groups_purpose_check check (char_length(purpose) <= 2000),
  add constraint community_groups_planned_check check (char_length(planned_activities) <= 2000),
  add constraint community_groups_frequency_check check (char_length(meeting_frequency) <= 200),
  add constraint community_groups_benefit_check check (char_length(neighborhood_benefit) <= 2000),
  add constraint community_groups_location_check check (meeting_location is null or char_length(meeting_location) <= 200),
  add constraint community_groups_info_check check (additional_info is null or char_length(additional_info) <= 2000),
  add constraint community_groups_review_status_check check (review_status = any (array['draft','pending_review','needs_changes','approved','rejected','suspended','archived']));
create index if not exists community_groups_review_idx on public.community_groups (review_status, neighborhood_id) where deleted_at is null;

alter table public.group_members drop constraint if exists group_members_status_check;
alter table public.group_members add constraint group_members_status_check
  check (status = any (array['pending','active','banned','left','removed','rejected']));

alter table public.profiles add column if not exists club_creation_suspended_until timestamptz;

-- ------------------------------------------------------------ new tables --
-- Self-declared date of birth. Not proof of age. Nobody can read it through the
-- API; only private.is_adult() exposes a boolean.
create table if not exists public.age_declarations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date not null check (date_of_birth >= date '1900-01-01'),
  declared_at timestamptz not null default now()
);
alter table public.age_declarations enable row level security;
create policy age_declarations_none on public.age_declarations for select using (false);
revoke all on public.age_declarations from anon, authenticated;

create table if not exists public.club_review_decisions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.community_groups(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision = any (array['approved','rejected','needs_changes','suspended','revoked','reinstated','submitted','resubmitted','archived'])),
  reason text check (reason is null or char_length(reason) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists club_review_decisions_club_idx on public.club_review_decisions (club_id, created_at desc);
alter table public.club_review_decisions enable row level security;
create policy club_review_decisions_select on public.club_review_decisions for select using (
  (select private.is_platform_admin())
  or exists (select 1 from public.community_groups g where g.id = club_review_decisions.club_id and g.owner_id = (select auth.uid())));

create table if not exists public.club_announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.community_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (btrim(body) <> '' and char_length(body) <= 3000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists club_announcements_club_idx on public.club_announcements (club_id, created_at desc);
alter table public.club_announcements enable row level security;
create policy club_announcements_select on public.club_announcements for select using (
  deleted_at is null and ((select private.is_active_group_member(club_id)) or (select private.is_platform_admin())));

revoke all on public.club_review_decisions, public.club_announcements from anon, authenticated;
grant select on public.club_review_decisions, public.club_announcements to authenticated;

-- ------------------------------------------------------------- helpers --
create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.deleted_at is null and p.app_role = 'admin');
$fn$;

create or replace function private.is_adult(target uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select exists (select 1 from public.age_declarations a where a.user_id = target and a.date_of_birth <= (current_date - interval '18 years')::date);
$fn$;

create or replace function private.club_status(target_club uuid)
returns text language sql stable security definer set search_path to '' as $fn$
  select g.review_status from public.community_groups g where g.id = target_club and g.deleted_at is null;
$fn$;

create or replace function private.club_member_role(target_club uuid)
returns text language sql stable security definer set search_path to '' as $fn$
  select gm.role from public.group_members gm where gm.group_id = target_club and gm.user_id = (select auth.uid()) and gm.status = 'active';
$fn$;

create or replace function private.can_manage_club(target_club uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select coalesce(private.club_member_role(target_club) in ('owner','moderator'), false);
$fn$;

-- Archived (deleted) or non-approved clubs have read-only chats.
create or replace function private.conversation_writable(target_conversation uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select coalesce((select g.review_status = 'approved' and g.deleted_at is null
    from public.conversations c join public.community_groups g on g.id = c.group_id where c.id = target_conversation), true);
$fn$;

create or replace function private.notify(target uuid, actor uuid, ntype text, title_ar text, title_en text, body_ar text, body_en text, link text)
returns void language sql security definer set search_path to '' as $fn$
  insert into public.notifications(user_id, actor_id, type, title_ar, title_en, body_ar, body_en, deep_link)
  values (target, actor, ntype, title_ar, title_en, left(body_ar, 300), left(body_en, 300), link);
$fn$;

create or replace function private.word_count(t text)
returns integer language sql immutable set search_path to '' as $fn$
  select coalesce(array_length(regexp_split_to_array(btrim(coalesce(t,'')), '\s+'), 1), 0) * (case when btrim(coalesce(t,'')) = '' then 0 else 1 end);
$fn$;

create or replace function private.clean(t text)
returns text language sql immutable set search_path to '' as $fn$
  select nullif(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), '');
$fn$;

create or replace function private.validate_club_application(p jsonb)
returns void language plpgsql immutable set search_path to '' as $fn$
begin
  if char_length(coalesce(private.clean(p->>'name'), '')) not between 3 and 80 then raise exception 'invalid:name' using errcode = '22023'; end if;
  if char_length(coalesce(private.clean(p->>'description'), '')) < 20 then raise exception 'invalid:description' using errcode = '22023'; end if;
  if char_length(coalesce(private.clean(p->>'purpose'), '')) < 20 then raise exception 'invalid:purpose' using errcode = '22023'; end if;
  if char_length(coalesce(private.clean(p->>'planned_activities'), '')) < 10 then raise exception 'invalid:planned_activities' using errcode = '22023'; end if;
  if private.clean(p->>'meeting_frequency') is null then raise exception 'invalid:meeting_frequency' using errcode = '22023'; end if;
  if char_length(coalesce(private.clean(p->>'neighborhood_benefit'), '')) < 40 or private.word_count(p->>'neighborhood_benefit') < 6 then
    raise exception 'invalid:neighborhood_benefit' using errcode = '22023';
  end if;
  if char_length(coalesce(private.clean(p->>'rules'), '')) < 10 then raise exception 'invalid:rules' using errcode = '22023'; end if;
  if coalesce(p->>'membership_type', '') not in ('open','approval') then raise exception 'invalid:membership_type' using errcode = '22023'; end if;
  if (p->>'category') = 'other' and char_length(coalesce(private.clean(p->>'custom_category'), '')) not between 1 and 40 then
    raise exception 'invalid:custom_category' using errcode = '22023';
  end if;
end;
$fn$;

-- Privileged profile fields: admins only. Nested server-side trigger chains
-- (reputation_events -> points) and non-API maintenance are allowed.
create or replace function private.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path to '' as $fn$
begin
  if (new.app_role, new.reputation_points, new.club_creation_suspended_until) is distinct from (old.app_role, old.reputation_points, old.club_creation_suspended_until)
     and not private.is_admin_or_moderator()
     and pg_trigger_depth() < 2
     and coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon') then
    raise exception 'privileged profile fields may only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end; $fn$;

create or replace function private.protect_event_club()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare g public.community_groups;
begin
  if new.club_id is not null and (tg_op = 'INSERT' or new.club_id is distinct from old.club_id) then
    select * into g from public.community_groups where id = new.club_id and deleted_at is null;
    if g.id is null or g.review_status <> 'approved' then
      raise exception 'club activities require an approved club' using errcode = '42501';
    end if;
    if not (private.can_manage_club(new.club_id) or private.is_platform_admin()) then
      raise exception 'only club organizers can create club activities' using errcode = '42501';
    end if;
    if g.neighborhood_id <> new.neighborhood_id then
      raise exception 'club activity must be in the club neighborhood' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists events_protect_club on public.events;
create trigger events_protect_club before insert or update on public.events for each row execute function private.protect_event_club();

-- Club images must be the uploader's own files inside the club's neighborhood folder.
create or replace function private.protect_club_media()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare prefix text := new.neighborhood_id || '/' || coalesce((select auth.uid())::text, '-') || '/';
begin
  if new.cover_image_path is not null and new.cover_image_path is distinct from (case when tg_op = 'UPDATE' then old.cover_image_path end)
     and left(new.cover_image_path, length(prefix)) <> prefix then
    raise exception 'invalid:cover_image_path' using errcode = '22023';
  end if;
  if new.logo_path is not null and new.logo_path is distinct from (case when tg_op = 'UPDATE' then old.logo_path end)
     and left(new.logo_path, length(prefix)) <> prefix then
    raise exception 'invalid:logo_path' using errcode = '22023';
  end if;
  return new;
end; $fn$;
drop trigger if exists community_groups_protect_media on public.community_groups;
create trigger community_groups_protect_media before insert or update of cover_image_path, logo_path on public.community_groups
for each row execute function private.protect_club_media();

-- -------------------------------------------------------------- policies --
drop policy if exists groups_select on public.community_groups;
create policy groups_select on public.community_groups for select using (
  deleted_at is null and ((select private.is_platform_admin()) or owner_id = (select auth.uid())
    or (select private.is_active_group_member(id))
    or (review_status = 'approved' and (select private.is_verified_neighborhood_member(neighborhood_id)))));
drop policy if exists groups_insert on public.community_groups;
create policy groups_insert on public.community_groups for insert with check (false);
drop policy if exists groups_update on public.community_groups;
create policy groups_update on public.community_groups for update using (false) with check (false);
drop policy if exists groups_delete on public.community_groups;
create policy groups_delete on public.community_groups for delete using ((select private.is_platform_admin()));

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select using (
  user_id = (select auth.uid())
  or (status = 'active' and (select private.is_active_group_member(group_id)))
  or (select private.can_manage_club(group_id))
  or (select private.is_platform_admin()));
drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members for insert with check (false);
drop policy if exists group_members_update on public.group_members;
create policy group_members_update on public.group_members for update using (false) with check (false);
drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete using (false);

alter policy messages_insert_member on public.messages with check (
  sender_id = (select auth.uid()) and (select private.is_conversation_member(conversation_id))
  and (select private.conversation_writable(conversation_id)));

alter policy events_update on public.events
  using (host_id = (select auth.uid()) or (select private.is_admin_or_moderator()) or (club_id is not null and (select private.can_manage_club(club_id))))
  with check (host_id = (select auth.uid()) or (select private.is_admin_or_moderator()) or (club_id is not null and (select private.can_manage_club(club_id))));

alter policy community_media_select_member on storage.objects using (
  bucket_id = 'community-media' and (
    (select private.is_verified_neighborhood_member((storage.foldername(objects.name))[1]))
    or (select private.is_platform_admin())));

-- ------------------------------------------------------- applicant RPCs --
create or replace function public.rsvp_event(target_event_id uuid, desired_status text default 'going')
returns public.event_attendees language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); event_row public.events; going_count integer; result public.event_attendees;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if desired_status not in ('going','interested') then raise exception 'invalid RSVP status' using errcode = '22023'; end if;
  select * into event_row from public.events where id=target_event_id and deleted_at is null for update;
  if not found or event_row.cancelled_at is not null or event_row.starts_at<=now() then raise exception 'event unavailable' using errcode='22023'; end if;
  if not private.is_verified_neighborhood_member(event_row.neighborhood_id) then raise exception 'neighborhood access denied' using errcode='42501'; end if;
  if event_row.club_id is not null then
    if private.club_status(event_row.club_id) <> 'approved' then raise exception 'club is not active' using errcode='42501'; end if;
    if event_row.members_only and not private.is_active_group_member(event_row.club_id) then
      raise exception 'this activity is for club members only' using errcode='42501';
    end if;
  end if;
  select * into result from public.event_attendees where event_id=target_event_id and user_id=caller and status in ('going','waitlisted','interested');
  if result is not null and result.status=desired_status then return result; end if;
  if desired_status='interested' then
    insert into public.event_attendees(event_id,user_id,status) values(target_event_id,caller,'interested')
    on conflict(event_id,user_id) do update set status='interested',waitlist_position=null,updated_at=now()
    returning * into result; return result;
  end if;
  select count(*) into going_count from public.event_attendees where event_id=target_event_id and status='going' and user_id<>caller;
  insert into public.event_attendees(event_id,user_id,status,waitlist_position)
  values(target_event_id,caller,
    case when going_count<event_row.capacity then 'going' else 'waitlisted' end,
    case when going_count<event_row.capacity then null else coalesce((select max(waitlist_position)+1 from public.event_attendees where event_id=target_event_id),1) end)
  on conflict(event_id,user_id) do update set status=excluded.status,waitlist_position=excluded.waitlist_position,updated_at=now()
  returning * into result; return result;
end;
$fn$;

create or replace function public.declare_date_of_birth(dob date)
returns boolean language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if dob is null or dob > current_date or dob < date '1900-01-01' then raise exception 'invalid date of birth' using errcode = '22023'; end if;
  if exists (select 1 from public.age_declarations where user_id = caller) then
    raise exception 'date of birth already declared; contact support to correct it' using errcode = '23505';
  end if;
  insert into public.age_declarations(user_id, date_of_birth) values (caller, dob);
  return private.is_adult(caller);
end;
$fn$;

create or replace function public.my_club_eligibility()
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); nb text; suspended timestamptz; pending int;
begin
  if caller is null then return jsonb_build_object('signed_in', false); end if;
  select neighborhood_id into nb from public.neighborhood_memberships where user_id = caller and active and verification_status = 'verified';
  select club_creation_suspended_until into suspended from public.profiles where id = caller;
  select count(*) into pending from public.community_groups where owner_id = caller and review_status = 'pending_review' and deleted_at is null;
  return jsonb_build_object(
    'signed_in', true,
    'verified_neighborhood_id', nb,
    'age_declared', exists (select 1 from public.age_declarations where user_id = caller),
    'is_adult', private.is_adult(caller),
    'suspended', suspended is not null and suspended > now(),
    'pending_applications', pending);
end;
$fn$;

create or replace function public.submit_club_application(p jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); nb text; created uuid; suspended timestamptz; recent int; pending int; admin_row record; club_name text;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  -- Neighborhood always comes from the server-side verified membership, never the client.
  select neighborhood_id into nb from public.neighborhood_memberships where user_id = caller and active and verification_status = 'verified';
  if nb is null then raise exception 'not_verified' using errcode = '42501'; end if;
  if not private.is_adult(caller) then raise exception 'not_adult' using errcode = '42501'; end if;
  select club_creation_suspended_until into suspended from public.profiles where id = caller and deleted_at is null;
  if not found then raise exception 'account unavailable' using errcode = '42501'; end if;
  if suspended is not null and suspended > now() then raise exception 'suspended' using errcode = '42501'; end if;
  select count(*) into recent from public.community_groups where owner_id = caller and created_at > now() - interval '24 hours';
  select count(*) into pending from public.community_groups where owner_id = caller and review_status in ('pending_review','needs_changes') and deleted_at is null;
  if recent >= 3 or pending >= 2 then raise exception 'rate_limited' using errcode = '22023'; end if;
  perform private.validate_club_application(p);
  club_name := private.clean(p->>'name');

  insert into public.community_groups(neighborhood_id, owner_id, name, description, visibility, category, custom_category,
    cover_image_path, logo_path, membership_type, rules, meeting_schedule, purpose, planned_activities, meeting_frequency,
    neighborhood_benefit, meeting_location, additional_info, review_status, submitted_at)
  values (nb, caller, club_name, private.clean(p->>'description'), 'neighborhood', p->>'category',
    case when p->>'category' = 'other' then private.clean(p->>'custom_category') end,
    private.clean(p->>'cover_image_path'), private.clean(p->>'logo_path'), p->>'membership_type', private.clean(p->>'rules'),
    private.clean(p->>'meeting_schedule'), private.clean(p->>'purpose'), private.clean(p->>'planned_activities'),
    private.clean(p->>'meeting_frequency'), private.clean(p->>'neighborhood_benefit'), private.clean(p->>'meeting_location'),
    private.clean(p->>'additional_info'), 'pending_review', now())
  returning id into created;

  insert into public.club_review_decisions(club_id, admin_id, decision) values (created, null, 'submitted');
  perform private.notify(caller, null, 'moderation', 'تم إرسال طلب النادي', 'Club application submitted',
    'سيراجع فريق حارتنا طلب «' || club_name || '» قبل ظهوره لسكان الحي.',
    'Our team will review "' || club_name || '" before it becomes available to your neighborhood.', '/clubs/' || created);
  for admin_row in select id from public.profiles where app_role = 'admin' and deleted_at is null and id <> caller loop
    perform private.notify(admin_row.id, caller, 'moderation', 'طلب نادٍ جديد للمراجعة', 'New club application to review',
      '«' || club_name || '» بانتظار المراجعة.', '"' || club_name || '" is waiting for review.', '/admin/clubs/' || created);
  end loop;
  return created;
end;
$fn$;

create or replace function public.update_club(target_club uuid, p jsonb)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups; admin_row record;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null for update;
  if g.id is null then raise exception 'club not found' using errcode = 'P0002'; end if;

  if g.review_status in ('draft','pending_review','needs_changes') then
    if g.owner_id <> caller then raise exception 'only the applicant can edit this application' using errcode = '42501'; end if;
    perform private.validate_club_application(p);
    update public.community_groups set
      name = private.clean(p->>'name'), description = private.clean(p->>'description'), category = p->>'category',
      custom_category = case when p->>'category' = 'other' then private.clean(p->>'custom_category') end,
      cover_image_path = private.clean(p->>'cover_image_path'), logo_path = private.clean(p->>'logo_path'),
      membership_type = p->>'membership_type', rules = private.clean(p->>'rules'), meeting_schedule = private.clean(p->>'meeting_schedule'),
      purpose = private.clean(p->>'purpose'), planned_activities = private.clean(p->>'planned_activities'),
      meeting_frequency = private.clean(p->>'meeting_frequency'), neighborhood_benefit = private.clean(p->>'neighborhood_benefit'),
      meeting_location = private.clean(p->>'meeting_location'), additional_info = private.clean(p->>'additional_info'),
      review_status = 'pending_review', submitted_at = now()
    where id = target_club;
    if g.review_status = 'needs_changes' then
      insert into public.club_review_decisions(club_id, admin_id, decision) values (target_club, null, 'resubmitted');
      for admin_row in select id from public.profiles where app_role = 'admin' and deleted_at is null and id <> caller loop
        perform private.notify(admin_row.id, caller, 'moderation', 'طلب نادٍ معدّل', 'Club application resubmitted',
          '«' || private.clean(p->>'name') || '» أُعيد إرساله بعد التعديل.', '"' || private.clean(p->>'name') || '" was updated and resubmitted.', '/admin/clubs/' || target_club);
      end loop;
    end if;
  elsif g.review_status = 'approved' then
    -- Approved clubs: organizers can edit presentation and rules; identity
    -- (name, category, neighborhood) changes need a new review.
    if not private.can_manage_club(target_club) then raise exception 'only club organizers can edit the club' using errcode = '42501'; end if;
    if char_length(coalesce(private.clean(p->>'description'), '')) < 20 then raise exception 'invalid:description' using errcode = '22023'; end if;
    if char_length(coalesce(private.clean(p->>'rules'), '')) < 10 then raise exception 'invalid:rules' using errcode = '22023'; end if;
    if coalesce(p->>'membership_type', '') not in ('open','approval') then raise exception 'invalid:membership_type' using errcode = '22023'; end if;
    update public.community_groups set
      description = private.clean(p->>'description'), rules = private.clean(p->>'rules'),
      meeting_schedule = private.clean(p->>'meeting_schedule'), meeting_location = private.clean(p->>'meeting_location'),
      membership_type = p->>'membership_type',
      cover_image_path = private.clean(p->>'cover_image_path'), logo_path = private.clean(p->>'logo_path')
    where id = target_club;
  else
    raise exception 'this club cannot be edited in its current state' using errcode = '42501';
  end if;
end;
$fn$;

create or replace function public.review_club(target_club uuid, decision text, reason text default null)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups; new_status text; clean_reason text := private.clean(reason);
begin
  if caller is null or not private.is_platform_admin() then raise exception 'administrator access required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null for update;
  if g.id is null then raise exception 'club not found' using errcode = 'P0002'; end if;
  if g.owner_id = caller then raise exception 'administrators cannot review their own club' using errcode = '42501'; end if;
  if decision <> 'approved' and decision <> 'reinstated' and clean_reason is null then raise exception 'a reason is required' using errcode = '22023'; end if;

  new_status := case decision
    when 'approved' then case when g.review_status = 'pending_review' then 'approved' end
    when 'rejected' then case when g.review_status in ('pending_review','needs_changes') then 'rejected' end
    when 'needs_changes' then case when g.review_status = 'pending_review' then 'needs_changes' end
    when 'suspended' then case when g.review_status = 'approved' then 'suspended' end
    when 'reinstated' then case when g.review_status = 'suspended' then 'approved' end
    when 'revoked' then case when g.review_status in ('approved','suspended') then 'rejected' end
  end;
  if new_status is null then raise exception 'invalid_transition' using errcode = '22023'; end if;
  if decision = 'approved' and not private.is_adult(g.owner_id) then raise exception 'organizer is not eligible' using errcode = '42501'; end if;

  update public.community_groups set review_status = new_status, review_note = clean_reason, reviewed_by = caller, reviewed_at = now(),
    approved_at = case when new_status = 'approved' and approved_at is null then now() else approved_at end
  where id = target_club;
  insert into public.club_review_decisions(club_id, admin_id, decision, reason) values (target_club, caller, decision, clean_reason);

  perform private.notify(g.owner_id, caller, 'moderation',
    case decision when 'approved' then 'تمت الموافقة على ناديك' when 'reinstated' then 'تمت إعادة تفعيل ناديك' when 'rejected' then 'لم تتم الموافقة على طلب النادي'
      when 'needs_changes' then 'مطلوب تعديلات على طلب النادي' when 'suspended' then 'تم تعليق ناديك' else 'تم سحب الموافقة على ناديك' end,
    case decision when 'approved' then 'Your club was approved' when 'reinstated' then 'Your club was reinstated' when 'rejected' then 'Club application not approved'
      when 'needs_changes' then 'Changes requested for your club' when 'suspended' then 'Your club was suspended' else 'Club approval revoked' end,
    '«' || g.name || '»' || coalesce(' — ' || clean_reason, ''), '"' || g.name || '"' || coalesce(' — ' || clean_reason, ''), '/clubs/' || target_club);
end;
$fn$;

do $grants$
declare f text;
begin
  foreach f in array array['public.declare_date_of_birth(date)', 'public.my_club_eligibility()', 'public.submit_club_application(jsonb)',
    'public.update_club(uuid,jsonb)', 'public.review_club(uuid,text,text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $grants$;

-- ------------------------------------------------------ membership RPCs --
-- Membership RPCs. group_members has no client write policies; every change goes through here.

create or replace function public.join_club(target_club uuid)
returns text language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups; existing public.group_members; recent int; new_status text; m record; who text;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null for update;
  if g.id is null or g.review_status <> 'approved' then raise exception 'club_unavailable' using errcode = '42501'; end if;
  if not private.is_verified_neighborhood_member(g.neighborhood_id) then raise exception 'not_verified' using errcode = '42501'; end if;
  select * into existing from public.group_members where group_id = target_club and user_id = caller;
  if existing.status = 'banned' then raise exception 'banned' using errcode = '42501'; end if;
  if existing.status in ('active', 'pending') then return existing.status; end if;
  select count(*) into recent from public.group_members where user_id = caller and updated_at > now() - interval '1 hour';
  if recent >= 20 then raise exception 'rate_limited' using errcode = '22023'; end if;
  new_status := case when g.membership_type = 'open' then 'active' else 'pending' end;
  insert into public.group_members(group_id, user_id, role, status) values (target_club, caller, 'member', new_status)
  on conflict (group_id, user_id) do update set status = excluded.status, role = 'member', joined_at = now();
  if new_status = 'pending' then
    select coalesce(nullif(trim(first_name), ''), 'جار') into who from public.profiles where id = caller;
    for m in select user_id from public.group_members where group_id = target_club and status = 'active' and role in ('owner', 'moderator') loop
      perform private.notify(m.user_id, caller, 'group_activity', 'طلب انضمام جديد', 'New join request',
        who || ' طلب الانضمام إلى «' || g.name || '».', who || ' asked to join "' || g.name || '".', '/clubs/' || g.id || '/members');
    end loop;
  end if;
  return new_status;
end; $fn$;

create or replace function public.cancel_join_request(target_club uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.group_members set status = 'left' where group_id = target_club and user_id = caller and status = 'pending';
end; $fn$;

create or replace function public.leave_club(target_club uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); r text;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select role into r from public.group_members where group_id = target_club and user_id = caller and status = 'active';
  if r = 'owner' then raise exception 'owner_must_transfer' using errcode = '42501'; end if;
  update public.group_members set status = 'left', role = 'member'
  where group_id = target_club and user_id = caller and status in ('active', 'pending');
end; $fn$;

create or replace function public.respond_join_request(target_club uuid, target_user uuid, approve boolean)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups; changed int;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null;
  if g.id is null then raise exception 'club_unavailable' using errcode = '42501'; end if;
  if not private.can_manage_club(target_club) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if approve and g.review_status <> 'approved' then raise exception 'club_unavailable' using errcode = '42501'; end if;
  update public.group_members set status = case when approve then 'active' else 'rejected' end, joined_at = case when approve then now() else joined_at end
  where group_id = target_club and user_id = target_user and status = 'pending';
  get diagnostics changed = row_count;
  if changed = 0 then return; end if;
  if approve then
    perform private.notify(target_user, caller, 'group_activity', 'تم قبول طلبك', 'Request approved',
      'أصبحت عضواً في «' || g.name || '».', 'You are now a member of "' || g.name || '".', '/clubs/' || g.id);
  else
    perform private.notify(target_user, caller, 'group_activity', 'لم يُقبل طلب الانضمام', 'Join request declined',
      'لم يُقبل طلبك للانضمام إلى «' || g.name || '».', 'Your request to join "' || g.name || '" was declined.', '/clubs/' || g.id);
  end if;
end; $fn$;

create or replace function public.set_member_role(target_club uuid, target_user uuid, new_role text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); target_row public.group_members;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if new_role not in ('moderator', 'member') then raise exception 'invalid role' using errcode = '22023'; end if;
  if private.club_member_role(target_club) is distinct from 'owner' then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into target_row from public.group_members where group_id = target_club and user_id = target_user and status = 'active' for update;
  if target_row.user_id is null or target_row.role = 'owner' then raise exception 'invalid target' using errcode = '22023'; end if;
  -- Minors may never administer a club.
  if new_role = 'moderator' and not private.is_adult(target_user) then raise exception 'not_adult' using errcode = '42501'; end if;
  update public.group_members set role = new_role where group_id = target_club and user_id = target_user;
  update public.conversation_members cm set role = new_role from public.conversations c
  where c.group_id = target_club and cm.conversation_id = c.id and cm.user_id = target_user;
end; $fn$;

create or replace function public.remove_club_member(target_club uuid, target_user uuid, ban boolean default false)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); my_role text; target_row public.group_members;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  my_role := private.club_member_role(target_club);
  if my_role is null or my_role not in ('owner', 'moderator') then raise exception 'not_authorized' using errcode = '42501'; end if;
  if target_user = caller then raise exception 'invalid target' using errcode = '22023'; end if;
  select * into target_row from public.group_members where group_id = target_club and user_id = target_user for update;
  if target_row.user_id is null then raise exception 'invalid target' using errcode = '22023'; end if;
  if target_row.role = 'owner' then raise exception 'cannot_remove_owner' using errcode = '42501'; end if;
  if target_row.role = 'moderator' and target_row.status = 'active' and my_role <> 'owner' then raise exception 'not_authorized' using errcode = '42501'; end if;
  -- The sync trigger sets left_at on the chat membership, so access ends immediately.
  update public.group_members set status = case when ban then 'banned' else 'removed' end, role = 'member'
  where group_id = target_club and user_id = target_user;
end; $fn$;

create or replace function public.unban_club_member(target_club uuid, target_user uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
begin
  if not private.can_manage_club(target_club) then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.group_members set status = 'removed' where group_id = target_club and user_id = target_user and status = 'banned';
end; $fn$;

create or replace function public.transfer_club_ownership(target_club uuid, new_owner uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null for update;
  if g.id is null or g.owner_id <> caller or private.club_member_role(target_club) is distinct from 'owner' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if new_owner = caller then raise exception 'invalid target' using errcode = '22023'; end if;
  if not exists (select 1 from public.group_members where group_id = target_club and user_id = new_owner and status = 'active') then
    raise exception 'invalid target' using errcode = '22023';
  end if;
  if not private.is_adult(new_owner) then raise exception 'not_adult' using errcode = '42501'; end if;
  -- Promote first so the club always has exactly one active owner.
  update public.group_members set role = 'owner' where group_id = target_club and user_id = new_owner;
  update public.group_members set role = 'moderator' where group_id = target_club and user_id = caller;
  update public.community_groups set owner_id = new_owner where id = target_club;
  update public.conversation_members cm set role = gm.role from public.conversations c, public.group_members gm
  where c.group_id = target_club and cm.conversation_id = c.id and gm.group_id = target_club and gm.user_id = cm.user_id
    and cm.user_id in (caller, new_owner);
  perform private.notify(new_owner, caller, 'group_activity', 'أصبحت منظم النادي', 'You now organize this club',
    'نُقلت إليك ملكية «' || g.name || '».', 'Ownership of "' || g.name || '" was transferred to you.', '/clubs/' || g.id);
end; $fn$;

create or replace function public.archive_club(target_club uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null for update;
  if g.id is null or g.owner_id <> caller then raise exception 'not_authorized' using errcode = '42501'; end if;
  -- Voluntary archive: hidden from everyone, data kept (never auto-deleted).
  update public.community_groups set deleted_at = now() where id = target_club;
  update public.events set cancelled_at = now() where club_id = target_club and cancelled_at is null and starts_at > now() and deleted_at is null;
  insert into public.club_review_decisions(club_id, admin_id, decision, reason) values (target_club, caller, 'archived', 'archived by organizer');
end; $fn$;

create or replace function public.post_club_announcement(target_club uuid, body text)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); g public.community_groups; created uuid; clean_body text := private.clean(body); recent int; m record;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null;
  if g.id is null or g.review_status <> 'approved' then raise exception 'club_unavailable' using errcode = '42501'; end if;
  if not private.can_manage_club(target_club) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if clean_body is null or char_length(clean_body) < 2 or char_length(clean_body) > 3000 then raise exception 'invalid:body' using errcode = '22023'; end if;
  select count(*) into recent from public.club_announcements where club_id = target_club and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'rate_limited' using errcode = '22023'; end if;
  insert into public.club_announcements(club_id, author_id, body) values (target_club, caller, clean_body) returning id into created;
  for m in select user_id from public.group_members where group_id = target_club and status = 'active' and user_id <> caller loop
    perform private.notify(m.user_id, caller, 'group_activity', 'إعلان جديد في «' || g.name || '»', 'New announcement in "' || g.name || '"',
      clean_body, clean_body, '/clubs/' || g.id);
  end loop;
  return created;
end; $fn$;

create or replace function public.delete_club_announcement(target_announcement uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare a public.club_announcements;
begin
  select * into a from public.club_announcements where id = target_announcement;
  if a.id is null or not (private.can_manage_club(a.club_id) or private.is_platform_admin()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.club_announcements set deleted_at = now() where id = target_announcement;
end; $fn$;

-- Club moderators can hide messages in their club chat (the sender can already via RLS).
create or replace function public.moderate_club_message(target_message uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare club uuid;
begin
  select c.group_id into club from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = target_message;
  if club is null or not (private.can_manage_club(club) or private.is_admin_or_moderator()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.messages set deleted_at = now() where id = target_message and deleted_at is null;
end; $fn$;

-- Member counts, only for clubs the caller is allowed to see (mirrors groups_select).
create or replace function public.club_member_counts(target_clubs uuid[])
returns table(club_id uuid, member_count bigint) language sql stable security definer set search_path to '' as $fn$
  select g.id, (select count(*) from public.group_members gm where gm.group_id = g.id and gm.status = 'active')
  from public.community_groups g
  where g.id = any(target_clubs) and g.deleted_at is null
    and (private.is_platform_admin() or g.owner_id = (select auth.uid()) or private.is_active_group_member(g.id)
      or (g.review_status = 'approved' and private.is_verified_neighborhood_member(g.neighborhood_id)));
$fn$;

-- Archived (deleted) or non-approved clubs have read-only chats.
create or replace function private.conversation_writable(target_conversation uuid)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select coalesce((select g.review_status = 'approved' and g.deleted_at is null
    from public.conversations c join public.community_groups g on g.id = c.group_id where c.id = target_conversation), true);
$fn$;

do $grants$
declare f text;
begin
  foreach f in array array[
    'public.join_club(uuid)', 'public.cancel_join_request(uuid)', 'public.leave_club(uuid)',
    'public.respond_join_request(uuid,uuid,boolean)', 'public.set_member_role(uuid,uuid,text)',
    'public.remove_club_member(uuid,uuid,boolean)', 'public.unban_club_member(uuid,uuid)',
    'public.transfer_club_ownership(uuid,uuid)', 'public.archive_club(uuid)',
    'public.post_club_announcement(uuid,text)', 'public.delete_club_announcement(uuid)',
    'public.moderate_club_message(uuid)', 'public.club_member_counts(uuid[])']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $grants$;

-- ------------------------------------------------- club activities/admin --
-- Organizers/moderators see pending, removed and banned rows of their own club.
alter policy group_members_select on public.group_members using (
  user_id = (select auth.uid())
  or (status = 'active' and (select private.is_active_group_member(group_id)))
  or (select private.can_manage_club(group_id))
  or (select private.is_platform_admin())
);

-- Club activities reuse public.events. A recurring schedule is materialised as one
-- events row per occurrence sharing series_id, so RSVPs, capacity, chat and the map
-- all work per occurrence and nothing is duplicated.
create or replace function public.create_club_activity(target_club uuid, p jsonb)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare
  caller uuid := (select auth.uid()); g public.community_groups; series uuid := gen_random_uuid();
  rec text := coalesce(p->>'recurrence', 'none'); n int; i int; first_start timestamptz; first_end timestamptz;
  step interval; created uuid; first_id uuid; cat text := p->>'category'; custom text; recent int; m record; title text := private.clean(p->>'title');
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null;
  if g.id is null or g.review_status <> 'approved' then raise exception 'club_unavailable' using errcode = '42501'; end if;
  if not private.can_manage_club(target_club) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if rec not in ('none', 'weekly', 'biweekly', 'monthly') then raise exception 'invalid:recurrence' using errcode = '22023'; end if;
  n := case when rec = 'none' then 1 else least(greatest(coalesce((p->>'occurrences')::int, 8), 2), 12) end;
  first_start := (p->>'starts_at')::timestamptz; first_end := (p->>'ends_at')::timestamptz;
  if first_start is null or first_end is null or first_end <= first_start or first_start <= now() then raise exception 'invalid:time' using errcode = '22023'; end if;
  if title is null or char_length(title) < 3 then raise exception 'invalid:title' using errcode = '22023'; end if;
  if cat = 'other' then
    custom := private.clean(p->>'custom_category');
    if custom is null or char_length(custom) > 40 then raise exception 'invalid:custom_category' using errcode = '22023'; end if;
  end if;
  select count(distinct series_id) into recent from public.events where club_id = target_club and created_at > now() - interval '1 hour';
  if recent >= 10 then raise exception 'rate_limited' using errcode = '22023'; end if;
  step := case rec when 'weekly' then interval '7 days' when 'biweekly' then interval '14 days' when 'monthly' then interval '1 month' else interval '0' end;

  for i in 0 .. n - 1 loop
    insert into public.events(neighborhood_id, host_id, kind, title, category, custom_category, description, starts_at, ends_at,
      location_label, approx_lat, approx_lng, capacity, audience, recurring, cover_image_path, club_id, series_id, recurrence, members_only)
    values (g.neighborhood_id, caller, coalesce(p->>'kind', 'activity'), title, cat, custom, coalesce(private.clean(p->>'description'), ''),
      first_start + step * i, first_end + step * i, coalesce(private.clean(p->>'location_label'), ''),
      round(((p->>'approx_lat')::numeric), 3)::double precision, round(((p->>'approx_lng')::numeric), 3)::double precision,
      greatest(coalesce((p->>'capacity')::int, 20), 1), 'neighborhood', rec <> 'none', private.clean(p->>'cover_image_path'),
      target_club, series, rec, coalesce((p->>'members_only')::boolean, false))
    returning id into created;
    if i = 0 then first_id := created; end if;
    insert into public.event_attendees(event_id, user_id, status) values (created, caller, 'going') on conflict do nothing;
  end loop;

  -- One notification per member for the whole series, not one per occurrence.
  for m in select user_id from public.group_members where group_id = target_club and status = 'active' and user_id <> caller loop
    perform private.notify(m.user_id, caller, 'group_activity', 'فعالية جديدة في «' || g.name || '»', 'New activity in "' || g.name || '"',
      title, title, '/event/' || first_id);
  end loop;
  return first_id;
end; $fn$;

create or replace function private.can_edit_club_event(e public.events)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select e.host_id = (select auth.uid()) or (e.club_id is not null and private.can_manage_club(e.club_id)) or private.is_admin_or_moderator();
$fn$;

create or replace function public.update_club_activity(target_event uuid, p jsonb, scope text default 'one')
returns int language plpgsql security definer set search_path to '' as $fn$
declare e public.events; shift interval := interval '0'; dur interval; changed int; cat text; custom text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if scope not in ('one', 'future') then raise exception 'invalid:scope' using errcode = '22023'; end if;
  select * into e from public.events where id = target_event and deleted_at is null;
  if e.id is null or not private.can_edit_club_event(e) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p ? 'starts_at' then
    shift := (p->>'starts_at')::timestamptz - e.starts_at;
    dur := coalesce((p->>'ends_at')::timestamptz - (p->>'starts_at')::timestamptz, e.ends_at - e.starts_at);
    if dur <= interval '0' or (p->>'starts_at')::timestamptz <= now() then raise exception 'invalid:time' using errcode = '22023'; end if;
  end if;
  cat := coalesce(p->>'category', e.category);
  if cat = 'other' then custom := coalesce(private.clean(p->>'custom_category'), e.custom_category);
    if custom is null or char_length(custom) > 40 then raise exception 'invalid:custom_category' using errcode = '22023'; end if;
  end if;
  update public.events set
    title = coalesce(private.clean(p->>'title'), title),
    description = coalesce(private.clean(p->>'description'), description),
    category = cat, custom_category = custom,
    location_label = coalesce(private.clean(p->>'location_label'), location_label),
    capacity = case when p->>'capacity' is null then capacity else greatest((p->>'capacity')::int, 1) end,
    members_only = case when club_id is null then false else coalesce((p->>'members_only')::boolean, members_only) end,
    starts_at = starts_at + shift,
    ends_at = case when dur is null then ends_at else starts_at + shift + dur end
  where deleted_at is null and cancelled_at is null and (
    id = e.id or (scope = 'future' and e.series_id is not null and series_id = e.series_id and starts_at >= e.starts_at));
  get diagnostics changed = row_count;
  return changed;
end; $fn$;

create or replace function public.cancel_club_activity(target_event uuid, scope text default 'one')
returns int language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); e public.events; ids uuid[]; u record;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if scope not in ('one', 'future') then raise exception 'invalid:scope' using errcode = '22023'; end if;
  select * into e from public.events where id = target_event and deleted_at is null;
  if e.id is null or not private.can_edit_club_event(e) then raise exception 'not_authorized' using errcode = '42501'; end if;
  with c as (
    update public.events set cancelled_at = now()
    where deleted_at is null and cancelled_at is null and starts_at > now() and (
      id = e.id or (scope = 'future' and e.series_id is not null and series_id = e.series_id and starts_at >= e.starts_at))
    returning id)
  select array_agg(id) into ids from c;
  if ids is null then return 0; end if;
  -- Each affected attendee hears about it once, however many occurrences were cancelled.
  for u in select distinct user_id from public.event_attendees where event_id = any(ids) and user_id <> caller and status in ('going', 'waitlisted', 'interested') loop
    perform private.notify(u.user_id, caller, 'group_activity', 'أُلغيت فعالية', 'Activity cancelled',
      e.title, e.title, '/event/' || e.id);
  end loop;
  return coalesce(array_length(ids, 1), 0);
end; $fn$;

-- Admin review support: real counts only, nothing inferred.
create or replace function public.admin_club_signals(target_club uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare g public.community_groups;
begin
  if not private.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club;
  if g.id is null then return null; end if;
  return jsonb_build_object(
    'member_count', (select count(*) from public.group_members where group_id = g.id and status = 'active'),
    'pending_requests', (select count(*) from public.group_members where group_id = g.id and status = 'pending'),
    'upcoming_activities', (select count(*) from public.events where club_id = g.id and deleted_at is null and cancelled_at is null and starts_at > now()),
    'activities_last_90_days', (select count(*) from public.events where club_id = g.id and deleted_at is null and starts_at between now() - interval '90 days' and now()),
    'messages_last_30_days', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id where c.group_id = g.id and m.created_at > now() - interval '30 days'),
    'announcements_last_30_days', (select count(*) from public.club_announcements where club_id = g.id and deleted_at is null and created_at > now() - interval '30 days'),
    'last_activity_at', greatest(
      (select max(starts_at) from public.events where club_id = g.id and deleted_at is null and starts_at <= now()),
      (select max(m.created_at) from public.messages m join public.conversations c on c.id = m.conversation_id where c.group_id = g.id),
      (select max(created_at) from public.club_announcements where club_id = g.id)),
    'inactivity_reminded_at', g.inactivity_reminded_at,
    'owner_is_adult', private.is_adult(g.owner_id),
    'reports_open', (select count(*) from public.reports where target_type = 'group' and target_id = g.id and status = 'open'));
end; $fn$;

create or replace function public.send_club_inactivity_reminder(target_club uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
declare g public.community_groups;
begin
  if not private.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into g from public.community_groups where id = target_club and deleted_at is null for update;
  if g.id is null or g.review_status <> 'approved' then raise exception 'club_unavailable' using errcode = '22023'; end if;
  if g.inactivity_reminded_at is not null and g.inactivity_reminded_at > now() - interval '14 days' then raise exception 'rate_limited' using errcode = '22023'; end if;
  update public.community_groups set inactivity_reminded_at = now() where id = g.id;
  perform private.notify(g.owner_id, (select auth.uid()), 'moderation', 'نادِيك هادئ مؤخراً', 'Your club has been quiet',
    'هل ترغب بجدولة فعالية جديدة لـ«' || g.name || '»؟ يمكنك أيضاً أرشفة النادي إن لم يعد نشطاً.',
    'Would you like to schedule a new activity for "' || g.name || '"? You can also archive the club if it is no longer active.', '/clubs/' || g.id);
end; $fn$;

-- Admin queue with applicant context. Never returns date of birth, only an adult flag.
create or replace function public.admin_club_applications(status_filter text default null)
returns table(club_id uuid, name text, review_status text, submitted_at timestamptz, owner_id uuid, owner_name text,
  owner_is_adult boolean, owner_verified_neighborhood text, neighborhood_id text, neighborhood_name_ar text, neighborhood_name_en text)
language plpgsql stable security definer set search_path to '' as $fn$
begin
  if not private.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
  select g.id, g.name, g.review_status, g.submitted_at, g.owner_id,
    trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')),
    private.is_adult(g.owner_id),
    (select nm.neighborhood_id from public.neighborhood_memberships nm where nm.user_id = g.owner_id and nm.active and nm.verification_status = 'verified' limit 1),
    g.neighborhood_id, n.name_ar, n.name_en
  from public.community_groups g
  left join public.profiles pr on pr.id = g.owner_id
  left join public.neighborhoods n on n.id = g.neighborhood_id
  where g.deleted_at is null and (status_filter is null or g.review_status = status_filter)
  order by g.submitted_at desc nulls last;
end; $fn$;

do $grants$
declare f text;
begin
  foreach f in array array[
    'public.create_club_activity(uuid,jsonb)', 'public.update_club_activity(uuid,jsonb,text)', 'public.cancel_club_activity(uuid,text)',
    'public.admin_club_signals(uuid)', 'public.send_club_inactivity_reminder(uuid)', 'public.admin_club_applications(text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  revoke all on function private.can_edit_club_event(public.events) from public, anon;
end $grants$;
