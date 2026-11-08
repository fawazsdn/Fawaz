begin;
set local lock_timeout = '5s';

alter table public.businesses
  add column if not exists name_ar text,
  add column if not exists name_en text,
  add column if not exists source_url text,
  add column if not exists source_checked_on date;

-- Existing ownership policies still apply. Add a publication gate so a
-- verified resident cannot read a draft linked by its owner.
create policy business_publication_gate on public.businesses
  as restrictive for select to authenticated
  using (
    verified or owner_id = (select auth.uid())
    or (select private.is_admin_or_moderator())
  );

-- Owners may edit their listings via existing policies, but they cannot
-- award themselves verification or overwrite the administrator's source.
create function private.guard_business_verification()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if (select auth.uid()) is null or (select private.is_admin_or_moderator()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.verified or new.source_url is not null or new.source_checked_on is not null then
      raise exception 'business_verification_requires_staff' using errcode = '42501';
    end if;
  elsif (new.verified, new.source_url, new.source_checked_on) is distinct from
        (old.verified, old.source_url, old.source_checked_on) then
    raise exception 'business_verification_requires_staff' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create trigger guard_business_verification
before insert or update on public.businesses
for each row execute function private.guard_business_verification();

-- Provider-owned sources are recorded per branch. This seed never edits a
-- listing already entered by an administrator or linked to another area.
-- Domino’s coordinates are the centre of the Plus Code on its store page.
with candidates(id, name, name_ar, category, location_label, phone, hours, source_url, approx_lat, approx_lng) as (
  values
    ('8325c364-be09-4c33-951b-b614fcb28d51'::uuid, 'Soma Grape Leaves', 'ورق عنب سوما', 'restaurant',
      '3J Street, Ajyal, Dhahran', '+966539800382', '24h',
      'https://www.soma.sa/ajyal', null, null),
    ('30ad6700-4009-445f-a5e3-c251a6200d26'::uuid, 'Knock Café', 'نوك كافيه', 'cafe',
      '3705, Ajyal District, Dhahran', null, null, 'https://linktr.ee/knock.saudi', null, null),
    ('0186c238-31a8-426c-a082-6bdd027d27c7'::uuid, 'Domino’s Pizza', 'دومينوز بيتزا', 'restaurant',
      '738C+56M, Ajyal, Dhahran 34513', '+966920012345', null,
      'https://store.dominos.sa/ar/almntk%D8%A9-alshrky%D8%A9/althhran/domino-s-pizza-domynoz-bytza-169',
      26.265462, 50.070547)
), seeded as (
  insert into public.businesses (id, name, name_ar, name_en, category, location_label, phone, hours, source_url, source_checked_on, city_id, verified, approx_lat, approx_lng)
  select c.id, c.name, c.name_ar, c.name, c.category, c.location_label, c.phone, c.hours, c.source_url,
    date '2026-11-08', n.city_id, true, c.approx_lat, c.approx_lng
  from candidates c
  join public.neighborhoods n on n.id = 'sa-district-10500227013'
  where not exists (
    select 1 from public.businesses b
    join public.business_neighborhoods bn on bn.business_id = b.id
    where bn.neighborhood_id = n.id and lower(b.name) in (lower(c.name), lower(c.name_ar))
  )
  on conflict (id) do nothing
  returning id
)
insert into public.business_neighborhoods (business_id, neighborhood_id)
select id, 'sa-district-10500227013' from seeded
on conflict do nothing;

commit;
