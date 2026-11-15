-- Haratna hosted staging: buckets and migration history (configuration only, no data).
-- Run on the STAGING project only, after the schema-only load and before the synthetic seed.
begin;
do $$ begin
  if exists (select 1 from public.regions where source <> 'synthetic') then
    raise exception 'non-synthetic geography present: not the staging project, stop';
  end if;
end $$;

-- The same bucket settings as production (2026-11-15). `profile-photos` is created by
-- migration 20261109130000, not here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('community-media', 'community-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic']),
  ('avatars',         'avatars',         true,  5242880,  array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

-- Starter moderation term list, the same seed as migration 20261014120000_compliance (repository
-- configuration, not production data; production's admin-added terms are not copied).
insert into public.moderation_terms(term) values
  ('fuck'), ('fucking'), ('motherfucker'), ('cunt'), ('nigger'), ('faggot'), ('whore'), ('slut'), ('bitch'),
  ('شرموطة'), ('قحبة'), ('منيوك'), ('منيك'), ('كسمك'), ('كس امك'), ('عرص'), ('زبي'), ('انيكك')
on conflict do nothing;

-- The schema-only load already equals production's head (20261108142118). Record the same
-- 31 versions so `supabase db push` applies only the three pending migrations.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260823203632', 'core_identity_geography'),
  ('20260823203648', 'community_content'),
  ('20260823203738', 'messaging_commerce_safety'),
  ('20260823203932', 'seed_saudi_regions'),
  ('20260823203957', 'seed_saudi_cities'),
  ('20260823204020', 'seed_saudi_neighborhoods'),
  ('20260823210008', 'security_hardening_and_atomic_creates'),
  ('20260823211002', 'advisor_performance_cleanup'),
  ('20260823212309', 'account_deletion'),
  ('20260823212849', 'referral_code_collision_hardening'),
  ('20260823213156', 'rls_helper_execution'),
  ('20260824000748', 'account_deletion_service_role_access'),
  ('20260918153250', 'enable_postgis_and_boundary_geometry'),
  ('20260918153732', 'load_neighborhood_boundary_geometry'),
  ('20260918153853', 'repair_or_clear_invalid_boundary_geometry_v2'),
  ('20260918154001', 'verify_neighborhood_location_rpc'),
  ('20260918154159', 'verify_neighborhood_location_rpc_v2'),
  ('20261012100000', 'polls_activities_map'),
  ('20261012110000', 'location_rpcs'),
  ('20261012120000', 'neighborhood_suggestions'),
  ('20261012155805', 'polls_allow_vote_change'),
  ('20261013100000', 'clubs'),
  ('20261014100000', 'neighbors'),
  ('20261014120000', 'compliance'),
  ('20261107113323', 'public_support'),
  ('20261107130837', 'admin_support_dashboard'),
  ('20261107131004', 'admin_support_dashboard_definer'),
  ('20261108092540', 'neighborhood_locking'),
  ('20261108105341', 'account_deletion_club_successor'),
  ('20261108142100', 'ajyal_directory'),
  ('20261108142118', 'business_directory_requests')
on conflict (version) do nothing;
commit;
