-- Keep initial onboarding available. After verification, moving requires review.
set local lock_timeout = '5s';

create table public.neighborhood_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_neighborhood_id text not null references public.neighborhoods(id),
  to_neighborhood_id text not null references public.neighborhoods(id),
  from_verified_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text check (char_length(btrim(review_note)) between 1 and 1000),
  check (from_neighborhood_id <> to_neighborhood_id)
);
create unique index neighborhood_change_one_pending
  on public.neighborhood_change_requests(user_id) where status = 'pending';
create index neighborhood_change_user_history on public.neighborhood_change_requests(user_id, created_at desc);
create index neighborhood_change_queue on public.neighborhood_change_requests(created_at) where status = 'pending';

alter table public.neighborhood_change_requests enable row level security;
revoke all on public.neighborhood_change_requests from public, anon, authenticated;
grant select on public.neighborhood_change_requests to authenticated;
create policy neighborhood_change_read on public.neighborhood_change_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

-- Verification attempts and review records must come from server functions.
revoke insert, update, delete, truncate, trigger on public.neighborhood_verifications from public, anon, authenticated;
revoke insert, update, delete, truncate, trigger on public.neighborhood_memberships from public, anon, authenticated;

create or replace function public.select_neighborhood(target_neighborhood_id text)
returns public.neighborhood_memberships
language plpgsql security definer set search_path to '' as $fn$
declare
  caller uuid := (select auth.uid());
  membership public.neighborhood_memberships;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = caller for no key update;
  if not found then raise exception 'profile required' using errcode = '42501'; end if;

  select * into membership from public.neighborhood_memberships
    where user_id = caller and active for update;
  if membership.verification_status = 'verified' then
    if membership.neighborhood_id = target_neighborhood_id then return membership; end if;
    raise exception 'neighborhood_locked' using errcode = '42501';
  end if;
  if not exists (select 1 from public.neighborhoods where id = target_neighborhood_id) then
    raise exception 'unknown neighborhood' using errcode = '23503';
  end if;

  update public.neighborhood_memberships set active = false
    where user_id = caller and active and neighborhood_id <> target_neighborhood_id;
  insert into public.neighborhood_memberships (user_id, neighborhood_id, verification_status, active)
    values (caller, target_neighborhood_id, 'pending', true)
    on conflict (user_id, neighborhood_id) do update
      set active = true, verification_status = 'pending', verified_at = null, verified_by = null
    returning * into membership;
  return membership;
end;
$fn$;

create function public.request_neighborhood_change(target_neighborhood_id text, reason text)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare
  caller uuid := (select auth.uid());
  membership public.neighborhood_memberships;
  request_id uuid;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = caller for no key update;
  select * into membership from public.neighborhood_memberships
    where user_id = caller and active for update;
  if not found or membership.verification_status <> 'verified' then
    raise exception 'verified membership required' using errcode = '42501';
  end if;
  insert into public.neighborhood_change_requests
    (user_id, from_neighborhood_id, to_neighborhood_id, from_verified_at, reason)
    values (caller, membership.neighborhood_id, target_neighborhood_id, membership.verified_at, btrim(reason))
    returning id into request_id;
  return request_id;
end;
$fn$;

create function public.review_neighborhood_change(request_id uuid, approve boolean, note text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare
  actor uuid := (select auth.uid());
  resident uuid;
  request public.neighborhood_change_requests;
  membership public.neighborhood_memberships;
begin
  if actor is null or private.is_platform_admin() is not true then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if approve is null or coalesce(char_length(btrim(note)), 0) not between 1 and 1000 then
    raise exception 'decision and review note required' using errcode = '22023';
  end if;

  select user_id into resident from public.neighborhood_change_requests where id = request_id;
  perform 1 from public.profiles where id = resident for no key update;
  select * into request from public.neighborhood_change_requests where id = request_id for update;
  if not found or request.status <> 'pending' then
    raise exception 'request is no longer pending' using errcode = '55000';
  end if;
  if actor = resident then raise exception 'cannot review own request' using errcode = '42501'; end if;
  if approve then
    select * into membership from public.neighborhood_memberships where user_id = resident and active for update;
    if not found or membership.verification_status <> 'verified'
      or membership.neighborhood_id <> request.from_neighborhood_id
      or membership.verified_at is distinct from request.from_verified_at then
      raise exception 'membership changed since request' using errcode = '55000';
    end if;
    perform public.admin_verify_member(resident, request.to_neighborhood_id, btrim(note));
  end if;
  update public.neighborhood_change_requests
    set status = case when approve then 'approved' else 'rejected' end,
        reviewed_at = now(), reviewed_by = actor, review_note = btrim(note)
    where id = request_id;
end;
$fn$;

revoke execute on function public.select_neighborhood(text) from public, anon;
revoke execute on function public.request_neighborhood_change(text, text) from public, anon;
revoke execute on function public.review_neighborhood_change(uuid, boolean, text) from public, anon;
grant execute on function public.select_neighborhood(text),
  public.request_neighborhood_change(text, text), public.review_neighborhood_change(uuid, boolean, text) to authenticated;

-- Serialize the existing maintenance RPCs with selection and review.
create or replace function public.admin_verify_member(target uuid, target_neighborhood text, note text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare membership uuid; actor uuid := (select auth.uid());
begin
  if not (private.is_platform_admin() or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  perform 1 from public.profiles where id = target for no key update;
  if coalesce(btrim(note), '') = '' then raise exception 'a note is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.neighborhoods where id = target_neighborhood) then raise exception 'unknown neighborhood' using errcode = '22023'; end if;
  update public.neighborhood_memberships set active = false where user_id = target and neighborhood_id <> target_neighborhood;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at, verified_by)
  values (target, target_neighborhood, 'verified', true, now(), actor)
  on conflict (user_id, neighborhood_id) do update set verification_status = 'verified', active = true, verified_at = now(), verified_by = actor
  returning id into membership;
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
  perform 1 from public.profiles where id = target for no key update;
  for m in select id from public.neighborhood_memberships where user_id = target and active loop
    update public.neighborhood_memberships set verification_status = 'unverified', active = false, verified_at = null where id = m.id;
    insert into public.neighborhood_verifications(membership_id, user_id, method, status, review_note, reviewed_by, reviewed_at)
    values (m.id, target, 'manual', 'rejected', coalesce(btrim(note), 'access revoked'), actor, now());
  end loop;
end; $fn$;
