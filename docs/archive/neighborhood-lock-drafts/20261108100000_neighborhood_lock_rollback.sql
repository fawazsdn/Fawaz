-- ROLLBACK for 20261108100000_neighborhood_lock.sql. Review before running.
-- Restores the previous select_neighborhood/admin_verify_member/
-- admin_revoke_membership definitions and removes the lock trigger and the
-- change-request functions. The neighborhood_change_requests table is KEPT
-- (it may hold residents' requests); drop it manually only if you are sure.
-- Memberships themselves are never modified by this script.
begin;

drop trigger if exists neighborhood_memberships_lock on public.neighborhood_memberships;
drop function if exists private.enforce_neighborhood_lock();
drop function if exists public.request_neighborhood_change(text, text);
drop function if exists public.cancel_neighborhood_change_request(uuid);
drop function if exists public.admin_decide_neighborhood_change(uuid, boolean, text);
drop function if exists public.admin_list_neighborhood_change_requests(text, int, int);

-- Previous (unlocked) behaviour, as it was in production before 2026-11-08.
create or replace function public.select_neighborhood(target_neighborhood_id text)
returns public.neighborhood_memberships language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); result public.neighborhood_memberships;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.neighborhoods n where n.id = target_neighborhood_id) then
    raise exception 'unknown neighborhood' using errcode = '23503';
  end if;
  update public.neighborhood_memberships set active = false, updated_at = now()
   where user_id = caller and active and neighborhood_id <> target_neighborhood_id;
  insert into public.neighborhood_memberships (user_id, neighborhood_id, verification_status, active)
  values (caller, target_neighborhood_id, 'pending', true)
  on conflict (user_id, neighborhood_id) do update
    set active = true,
        verification_status = case when public.neighborhood_memberships.verification_status = 'verified' then 'verified' else 'pending' end,
        updated_at = now()
  returning * into result;
  return result;
end; $fn$;

-- admin_verify_member / admin_revoke_membership: the set_config lines added by
-- the migration are harmless without the trigger, so they can stay as they are.

-- The TRUNCATE/TRIGGER/REFERENCES revokes are a security hardening and should
-- NOT be rolled back; they are not used by the app or the Data API.

commit;
