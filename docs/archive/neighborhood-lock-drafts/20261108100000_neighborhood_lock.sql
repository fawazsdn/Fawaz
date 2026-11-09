-- Neighborhood locking + change requests.
--
-- Problem fixed: select_neighborhood() let a verified resident switch their
-- active membership at will (and even jump back to an old neighborhood and be
-- "verified" again without a new location check).
--
-- After this migration:
--  * A resident without a verified neighborhood can still choose freely
--    (onboarding unchanged).
--  * Once verified, the neighborhood is locked. Changing it requires a change
--    request that a platform admin approves; the current membership stays
--    active while the request is pending.
--  * Locking is enforced in the database twice: in select_neighborhood() and
--    by a trigger on neighborhood_memberships that refuses to deactivate or
--    move a verified active membership unless an admin function marked the
--    transaction as approved (a transaction-local setting that API clients
--    cannot set).
--  * Admins cannot approve their own requests; approval moves the membership
--    atomically and records an audited 'manual' verification.
--  * Existing verified memberships are untouched (they simply become locked).
--
-- Rollback: supabase/rollbacks/20261108100000_neighborhood_lock_rollback.sql
-- Applied to ckqwziutmqohihrenstz via the Supabase MCP on 2026-11-08.

-- ------------------------------------------------------- lock trigger --
create or replace function private.enforce_neighborhood_lock()
returns trigger language plpgsql set search_path to '' as $fn$
begin
  if coalesce(current_setting('haratna.membership_change', true), '') = 'approved' then
    return new;
  end if;
  if old.active and old.verification_status = 'verified'
     and (new.active is distinct from true or new.neighborhood_id is distinct from old.neighborhood_id
          or new.user_id is distinct from old.user_id or new.verification_status is distinct from 'verified') then
    raise exception 'neighborhood_locked' using errcode = '42501',
      hint = 'A verified neighborhood can only be changed through an approved change request.';
  end if;
  return new;
end; $fn$;

drop trigger if exists neighborhood_memberships_lock on public.neighborhood_memberships;
create trigger neighborhood_memberships_lock before update on public.neighborhood_memberships
  for each row execute function private.enforce_neighborhood_lock();

-- ------------------------------------------------- select_neighborhood --
create or replace function public.select_neighborhood(target_neighborhood_id text)
returns public.neighborhood_memberships language plpgsql security definer set search_path to '' as $fn$
declare
  caller uuid := (select auth.uid());
  current_m public.neighborhood_memberships;
  result public.neighborhood_memberships;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.neighborhoods n where n.id = target_neighborhood_id) then
    raise exception 'unknown neighborhood' using errcode = '23503';
  end if;

  select * into current_m from public.neighborhood_memberships m where m.user_id = caller and m.active for update;
  if current_m.id is not null and current_m.verification_status = 'verified' then
    -- Locked. Re-selecting the same neighborhood is a harmless no-op.
    if current_m.neighborhood_id = target_neighborhood_id then return current_m; end if;
    raise exception 'neighborhood_locked' using errcode = '42501',
      hint = 'Submit a neighborhood change request instead.';
  end if;

  update public.neighborhood_memberships m
     set active = false, updated_at = now()
   where m.user_id = caller and m.active and m.neighborhood_id <> target_neighborhood_id;

  -- A previously verified (now inactive) membership is NOT silently re-verified:
  -- the resident must pass the location check again.
  insert into public.neighborhood_memberships (user_id, neighborhood_id, verification_status, active)
  values (caller, target_neighborhood_id, 'pending', true)
  on conflict (user_id, neighborhood_id) do update
    set active = true, verification_status = 'pending', verified_at = null, verified_by = null, updated_at = now()
  returning * into result;
  return result;
end; $fn$;

-- --------------------------------------------- change request table --
create table if not exists public.neighborhood_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_neighborhood_id text not null references public.neighborhoods(id) on update cascade,
  to_neighborhood_id text not null references public.neighborhoods(id) on update cascade,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_neighborhood_id <> to_neighborhood_id),
  check ((status = 'pending') = (decided_at is null) or status = 'cancelled')
);
create unique index if not exists neighborhood_change_requests_one_pending on public.neighborhood_change_requests (user_id) where status = 'pending';
create index if not exists neighborhood_change_requests_status_idx on public.neighborhood_change_requests (status, created_at desc);
create index if not exists neighborhood_change_requests_user_idx on public.neighborhood_change_requests (user_id, created_at desc);
create index if not exists neighborhood_change_requests_decided_by_idx on public.neighborhood_change_requests (decided_by) where decided_by is not null;

alter table public.neighborhood_change_requests enable row level security;
create policy neighborhood_change_requests_select on public.neighborhood_change_requests for select
  using (user_id = (select auth.uid()) or (select private.is_admin_or_moderator()));
revoke all on public.neighborhood_change_requests from anon, authenticated;
grant select on public.neighborhood_change_requests to authenticated;

create trigger neighborhood_change_requests_set_updated_at before update on public.neighborhood_change_requests
  for each row execute function private.set_updated_at();
create trigger neighborhood_change_requests_filter_ugc before insert or update of reason on public.neighborhood_change_requests
  for each row execute function private.filter_ugc('reason');

-- -------------------------------------------------------- resident RPCs --
create or replace function public.request_neighborhood_change(target_neighborhood_id text, reason text)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); m public.neighborhood_memberships; recent int; created uuid; staff record;
  body text := btrim(coalesce(request_neighborhood_change.reason, ''));
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into m from public.neighborhood_memberships x where x.user_id = caller and x.active and x.verification_status = 'verified';
  if m.id is null then raise exception 'not_verified' using errcode = '42501'; end if;
  if not exists (select 1 from public.neighborhoods n where n.id = target_neighborhood_id) then
    raise exception 'unknown neighborhood' using errcode = '23503';
  end if;
  if target_neighborhood_id = m.neighborhood_id then raise exception 'invalid:same_neighborhood' using errcode = '22023'; end if;
  if char_length(body) < 10 or char_length(body) > 1000 then raise exception 'invalid:reason' using errcode = '22023'; end if;
  if exists (select 1 from public.neighborhood_change_requests r where r.user_id = caller and r.status = 'pending') then
    raise exception 'request_pending' using errcode = '22023';
  end if;
  select count(*) into recent from public.neighborhood_change_requests r
   where r.user_id = caller and r.created_at > now() - interval '30 days';
  if recent >= 3 then raise exception 'rate_limited' using errcode = '22023'; end if;

  insert into public.neighborhood_change_requests(user_id, from_neighborhood_id, to_neighborhood_id, reason)
  values (caller, m.neighborhood_id, target_neighborhood_id, body) returning id into created;

  for staff in select p.id from public.profiles p where p.app_role = 'admin' and p.deleted_at is null and p.id <> caller loop
    perform private.notify(staff.id, caller, 'moderation', 'طلب تغيير حي', 'Neighborhood change request',
      left(body, 140), left(body, 140), '/admin/neighborhood-requests');
  end loop;
  return created;
end; $fn$;

create or replace function public.cancel_neighborhood_change_request(request uuid)
returns void language plpgsql security definer set search_path to '' as $fn$
begin
  update public.neighborhood_change_requests r set status = 'cancelled', decided_at = now()
   where r.id = request and r.user_id = (select auth.uid()) and r.status = 'pending';
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end; $fn$;

-- ----------------------------------------------------------- admin RPCs --
create or replace function public.admin_decide_neighborhood_change(request uuid, approve boolean, note text default null)
returns void language plpgsql security definer set search_path to '' as $fn$
declare actor uuid := (select auth.uid()); r public.neighborhood_change_requests; m public.neighborhood_memberships;
  membership uuid; clean_note text := nullif(btrim(coalesce(note, '')), '');
begin
  if not private.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if clean_note is not null and char_length(clean_note) > 1000 then raise exception 'invalid:note' using errcode = '22023'; end if;
  select * into r from public.neighborhood_change_requests x where x.id = request for update;
  if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'already_decided' using errcode = '22023'; end if;
  if r.user_id = actor then raise exception 'cannot_decide_own_request' using errcode = '42501'; end if;

  if approve then
    select * into m from public.neighborhood_memberships x where x.user_id = r.user_id and x.active for update;
    if m.id is null or m.neighborhood_id <> r.from_neighborhood_id then
      raise exception 'stale_request' using errcode = '22023';
    end if;
    perform set_config('haratna.membership_change', 'approved', true);
    update public.neighborhood_memberships x set active = false, updated_at = now() where x.id = m.id;
    insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at, verified_by)
    values (r.user_id, r.to_neighborhood_id, 'verified', true, now(), actor)
    on conflict (user_id, neighborhood_id) do update
      set verification_status = 'verified', active = true, verified_at = now(), verified_by = actor, updated_at = now()
    returning id into membership;
    perform set_config('haratna.membership_change', '', true);
    insert into public.neighborhood_verifications(membership_id, user_id, method, status, review_note, reviewed_by, reviewed_at)
    values (membership, r.user_id, 'manual', 'verified', left('Approved neighborhood change request ' || r.id || coalesce(': ' || clean_note, ''), 1000), actor, now());
  end if;

  update public.neighborhood_change_requests x
     set status = case when approve then 'approved' else 'rejected' end, decision_note = clean_note, decided_by = actor, decided_at = now()
   where x.id = request;

  perform private.notify(r.user_id, actor, 'moderation',
    case when approve then 'تمت الموافقة على تغيير الحي' else 'تم رفض طلب تغيير الحي' end,
    case when approve then 'Neighborhood change approved' else 'Neighborhood change request declined' end,
    coalesce(clean_note, ''), coalesce(clean_note, ''), '/neighborhood-change');
end; $fn$;

create or replace function public.admin_list_neighborhood_change_requests(p_status text default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare result jsonb;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  with filtered as (
    select r.* from public.neighborhood_change_requests r where p_status is null or r.status = p_status
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'pending', (select count(*) from public.neighborhood_change_requests where status = 'pending'),
    'rows', coalesce((select jsonb_agg(row_to_json(t) order by t.created_at desc) from (
      select f.id, f.user_id, f.status, f.reason, f.decision_note, f.created_at, f.decided_at,
             nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), '') as user_name,
             nullif(btrim(concat_ws(' ', d.first_name, d.last_name)), '') as decided_by_name,
             f.from_neighborhood_id, fn.name_ar as from_name_ar, fn.name_en as from_name_en,
             f.to_neighborhood_id, tn.name_ar as to_name_ar, tn.name_en as to_name_en,
             (select count(*) from public.neighborhood_change_requests h where h.user_id = f.user_id) as user_request_count,
             (select m.neighborhood_id from public.neighborhood_memberships m where m.user_id = f.user_id and m.active) as current_neighborhood_id
      from filtered f
      left join public.profiles u on u.id = f.user_id
      left join public.profiles d on d.id = f.decided_by
      left join public.neighborhoods fn on fn.id = f.from_neighborhood_id
      left join public.neighborhoods tn on tn.id = f.to_neighborhood_id
      order by (f.status = 'pending') desc, f.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) t), '[]'::jsonb))
  into result;
  return result;
end; $fn$;

-- Existing admin functions that legitimately move or revoke memberships mark
-- the transaction as approved so the lock trigger lets them through.
create or replace function public.admin_verify_member(target uuid, target_neighborhood text, note text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare membership uuid; actor uuid := (select auth.uid());
begin
  if not (private.is_platform_admin() or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if coalesce(btrim(note), '') = '' then raise exception 'a note is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.neighborhoods where id = target_neighborhood) then raise exception 'unknown neighborhood' using errcode = '22023'; end if;
  perform set_config('haratna.membership_change', 'approved', true);
  update public.neighborhood_memberships set active = false where user_id = target and neighborhood_id <> target_neighborhood;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at, verified_by)
  values (target, target_neighborhood, 'verified', true, now(), actor)
  on conflict (user_id, neighborhood_id) do update set verification_status = 'verified', active = true, verified_at = now(), verified_by = actor
  returning id into membership;
  perform set_config('haratna.membership_change', '', true);
  insert into public.neighborhood_verifications(membership_id, user_id, method, status, review_note, reviewed_by, reviewed_at)
  values (membership, target, 'manual', 'verified', btrim(note), actor, now());
end; $fn$;

create or replace function public.admin_revoke_membership(target uuid, note text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare m record; actor uuid := (select auth.uid());
begin
  if not (private.is_platform_admin() or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  perform set_config('haratna.membership_change', 'approved', true);
  for m in select id from public.neighborhood_memberships where user_id = target and active loop
    update public.neighborhood_memberships set verification_status = 'unverified', active = false, verified_at = null where id = m.id;
    insert into public.neighborhood_verifications(membership_id, user_id, method, status, review_note, reviewed_by, reviewed_at)
    values (m.id, target, 'manual', 'rejected', coalesce(btrim(note), 'access revoked'), actor, now());
  end loop;
  perform set_config('haratna.membership_change', '', true);
end; $fn$;

-- --------------------------------------------------------------- grants --
do $grants$
declare f text;
begin
  foreach f in array array['public.request_neighborhood_change(text,text)', 'public.cancel_neighborhood_change_request(uuid)',
    'public.admin_decide_neighborhood_change(uuid,boolean,text)', 'public.admin_list_neighborhood_change_requests(text,int,int)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $grants$;
revoke all on function private.enforce_neighborhood_lock() from public, anon, authenticated;

-- Defence in depth: the Data API never uses TRUNCATE/TRIGGER/REFERENCES, so
-- remove these default grants from API roles on every public table.
do $hardening$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.relname);
  end loop;
end $hardening$;
