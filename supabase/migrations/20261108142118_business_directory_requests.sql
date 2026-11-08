begin;
set local lock_timeout = '5s';

create table public.business_directory_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  neighborhood_id text not null references public.neighborhoods(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('suggestion', 'correction', 'claim')),
  details text not null check (char_length(btrim(details)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'suggestion') = (business_id is null))
);

create unique index business_request_one_pending_per_kind
  on public.business_directory_requests (requester_id, business_id, kind)
  where status = 'pending' and business_id is not null;
create index business_request_requester
  on public.business_directory_requests (requester_id, created_at desc);
create index business_request_inbox
  on public.business_directory_requests (status, created_at desc);

alter table public.business_directory_requests enable row level security;
revoke all on public.business_directory_requests from anon, authenticated;
grant select on public.business_directory_requests to authenticated;

create policy business_request_read on public.business_directory_requests
  for select to authenticated using (
    requester_id = (select auth.uid()) or (select private.is_platform_admin())
  );

create function public.submit_business_directory_request(
  p_neighborhood text, p_business uuid, p_kind text, p_details text
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare
  actor uuid := (select auth.uid());
  created uuid;
begin
  if actor is null or not coalesce(private.is_verified_neighborhood_member(p_neighborhood), false) then
    raise exception 'not_verified' using errcode = '42501';
  end if;
  if p_kind not in ('suggestion', 'correction', 'claim') or p_kind is null
     or (p_kind = 'suggestion') <> (p_business is null)
     or char_length(btrim(coalesce(p_details, ''))) not between 10 and 2000 then
    raise exception 'invalid:business_request' using errcode = '22023';
  end if;
  if p_business is not null and not exists (
    select from public.businesses b
    join public.business_neighborhoods bn on bn.business_id = b.id
    where b.id = p_business and bn.neighborhood_id = p_neighborhood and b.verified and b.deleted_at is null
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- Serialize the per-resident rolling limit across concurrent submissions.
  perform pg_advisory_xact_lock(hashtextextended('business_directory:' || actor::text, 0));
  if (select count(*) from public.business_directory_requests
      where requester_id = actor and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.business_directory_requests(requester_id, neighborhood_id, business_id, kind, details)
    values (actor, p_neighborhood, p_business, p_kind, btrim(p_details))
    returning id into created;
  return created;
end;
$fn$;

create function public.review_business_directory_request(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $fn$
declare
  actor uuid := (select auth.uid());
  item public.business_directory_requests;
begin
  if actor is null or not coalesce(private.is_platform_admin(), false) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_approve is null then raise exception 'invalid:decision' using errcode = '22023'; end if;
  select * into item from public.business_directory_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  -- Corrections and suggestions are recorded for staff follow-up. Resident
  -- free text is never used directly to publish or overwrite a business.
  if p_approve and item.kind = 'claim' then
    update public.businesses
      set owner_id = item.requester_id
      where id = item.business_id and owner_id is null and verified and deleted_at is null;
    if not found then raise exception 'invalid:business_claim_unavailable' using errcode = '22023'; end if;
  end if;
  update public.business_directory_requests
    set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = actor, reviewed_at = now()
    where id = item.id;
end;
$fn$;

revoke all on function public.submit_business_directory_request(text, uuid, text, text) from public, anon;
revoke all on function public.review_business_directory_request(uuid, boolean) from public, anon;
grant execute on function public.submit_business_directory_request(text, uuid, text, text) to authenticated;
grant execute on function public.review_business_directory_request(uuid, boolean) to authenticated;

commit;
