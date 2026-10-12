-- "Can't find your neighborhood?" suggestions, stored server-side for staff
-- review instead of only on the device. Residents see only their own rows.
-- Applied to project ckqwziutmqohihrenstz on 2026-10-12.
create table if not exists public.neighborhood_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  region_id text not null references public.regions(id),
  city_id text not null references public.cities(id),
  name_ar text not null check (btrim(name_ar) <> '' and char_length(name_ar) <= 200),
  name_en text check (name_en is null or char_length(name_en) <= 200),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','duplicate')),
  created_at timestamptz not null default now()
);
alter table public.neighborhood_suggestions enable row level security;
create policy neighborhood_suggestions_insert_own on public.neighborhood_suggestions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy neighborhood_suggestions_select_own on public.neighborhood_suggestions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin_or_moderator()));
create policy neighborhood_suggestions_update_staff on public.neighborhood_suggestions for update to authenticated
  using ((select private.is_admin_or_moderator())) with check ((select private.is_admin_or_moderator()));
create index if not exists neighborhood_suggestions_user_idx on public.neighborhood_suggestions(user_id);
revoke all on public.neighborhood_suggestions from anon;
