-- Remove the obsolete custom role haratna_backup.
-- NOT A MIGRATION. Run only with the owner's separate written approval, as `postgres`
-- (SQL editor or `psql`), after a fresh encrypted backup. Touches no data and no
-- Supabase-managed role. The whole script is one transaction: any failed check aborts it.
begin;
set local lock_timeout = '5s';

do $$
declare r oid; n int;
begin
  select oid into r from pg_roles where rolname = 'haratna_backup';
  if r is null then raise exception 'haratna_backup does not exist: nothing to do'; end if;

  -- 1. It must own nothing in this database.
  select (select count(*) from pg_class where relowner = r) + (select count(*) from pg_proc where proowner = r)
       + (select count(*) from pg_namespace where nspowner = r) + (select count(*) from pg_type where typowner = r)
    into n;
  if n > 0 then raise exception 'haratna_backup owns % objects: stop', n; end if;

  -- 2. It must be unable to log in, and nobody may be connected as it.
  if exists (select 1 from pg_roles where oid = r and rolcanlogin) then raise exception 'role can log in: stop'; end if;
  if exists (select 1 from pg_stat_activity where usesysid = r) then raise exception 'active session: stop'; end if;

  -- 3. It must not be a member of any role, and its only member may be postgres (the creator's admin link).
  if exists (select 1 from pg_auth_members where member = r) then raise exception 'member of another role: stop'; end if;
  if exists (select 1 from pg_auth_members m join pg_roles u on u.oid = m.member where m.roleid = r and u.rolname <> 'postgres')
    then raise exception 'unexpected member: stop'; end if;

  -- 4. No policy, default ACL or function body may name it.
  if exists (select 1 from pg_policy where r = any(polroles)) then raise exception 'named in a policy: stop'; end if;
  if exists (select 1 from pg_default_acl where defaclrole = r) then raise exception 'has default privileges: stop'; end if;
  if exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
             where s.nspname not in ('pg_catalog','information_schema') and p.prosrc ilike '%haratna_backup%')
    then raise exception 'a function mentions it: stop'; end if;
end $$;

-- Revoke every privilege granted to it in this database (owns nothing, so nothing is dropped),
-- then drop the role. Its per-role setting goes with it.
drop owned by haratna_backup;
drop role haratna_backup;

-- 5. Confirm.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'haratna_backup') then raise exception 'still present'; end if;
end $$;
commit;
