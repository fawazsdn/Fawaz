-- Minimal Supabase platform stand-in for verifying a logical backup locally.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions; create schema if not exists auth; create schema if not exists storage;
create schema if not exists private; create schema if not exists supabase_migrations;
create extension if not exists postgis schema extensions;
create extension if not exists pgcrypto schema extensions;
create extension if not exists pg_trgm schema extensions;
create extension if not exists "uuid-ossp" schema extensions;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','anon') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(current_setting('request.jwt.claims', true)::jsonb,'{}') $$;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
create or replace function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'),1)] $$;
set search_path = public, extensions;
