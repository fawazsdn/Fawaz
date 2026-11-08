\set ON_ERROR_STOP on
begin;

do $test$
declare
  resident uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  moderator uuid := gen_random_uuid();
  a text;
  b text;
  request_id uuid;
  membership public.neighborhood_memberships;
begin
  select min(id), max(id) into a, b from public.neighborhoods;
  if a is null or a = b then raise exception 'test requires two neighborhoods'; end if;

  insert into auth.users(id, aud, role, email, instance_id)
  select id, 'authenticated', 'authenticated', id || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[resident, outsider, admin, moderator]) as id;
  update public.profiles set app_role = 'admin' where id = admin;
  update public.profiles set app_role = 'moderator' where id = moderator;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', resident, 'role', 'authenticated')::text, true);
  perform public.select_neighborhood(a);
  perform public.select_neighborhood(b);
  membership := public.select_neighborhood(a);
  if membership.verification_status <> 'pending' then raise exception 'initial selection failed'; end if;
  begin
    perform public.request_neighborhood_change(b, 'I moved to the new neighborhood.');
    raise exception 'unverified request accepted';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'postgres', true);
  perform public.admin_verify_member(resident, a, 'Test verification');
  perform set_config('role', 'authenticated', true);

  membership := public.select_neighborhood(a);
  if membership.verification_status <> 'verified' then raise exception 'same neighborhood lost verification'; end if;
  begin
    perform public.select_neighborhood(b);
    raise exception 'verified neighborhood switch accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'neighborhood_locked' then raise; end if;
  end;
  if has_table_privilege('authenticated', 'public.neighborhood_memberships', 'UPDATE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.neighborhood_verifications', 'INSERT, UPDATE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.neighborhood_change_requests', 'INSERT, UPDATE, TRUNCATE') then
    raise exception 'client can bypass an RPC';
  end if;
  if has_function_privilege('anon', 'public.request_neighborhood_change(text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_neighborhood_change(uuid,boolean,text)', 'EXECUTE') then
    raise exception 'anonymous request or review is executable';
  end if;

  request_id := public.request_neighborhood_change(b, 'I moved to the new neighborhood.');
  if not exists (select 1 from public.neighborhood_change_requests where id = request_id and status = 'pending') then
    raise exception 'resident cannot see own request';
  end if;
  if not exists (select 1 from public.neighborhood_memberships where user_id = resident and neighborhood_id = a and active) then
    raise exception 'request changed active membership';
  end if;
  begin
    perform public.request_neighborhood_change(b, 'Duplicate pending request.');
    raise exception 'duplicate pending request accepted';
  exception when unique_violation then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.neighborhood_change_requests where id = request_id) then
    raise exception 'resident can read another resident request';
  end if;
  begin
    perform public.review_neighborhood_change(request_id, true, 'Forged decision');
    raise exception 'resident reviewed request';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', moderator, 'role', 'authenticated')::text, true);
  begin
    perform public.review_neighborhood_change(request_id, true, 'Moderator decision');
    raise exception 'moderator reviewed request';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.neighborhood_change_requests where id = request_id) then
    raise exception 'admin cannot see request';
  end if;
  perform public.review_neighborhood_change(request_id, false, 'Evidence required');
  if not exists (select 1 from public.neighborhood_change_requests where id = request_id and status = 'rejected' and reviewed_by = admin)
     or not exists (select 1 from public.neighborhood_memberships where user_id = resident and neighborhood_id = a and active) then
    raise exception 'rejection was not audited or moved resident';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', resident, 'role', 'authenticated')::text, true);
  request_id := public.request_neighborhood_change(b, 'I moved and supplied the details.');
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  perform public.review_neighborhood_change(request_id, true, 'Move verified');
  begin
    perform public.review_neighborhood_change(request_id, false, 'Repeated decision');
    raise exception 'completed request reviewed again';
  exception when object_not_in_prerequisite_state then null;
  end;

  perform set_config('role', 'postgres', true);
  if not exists (select 1 from public.neighborhood_change_requests where id = request_id and status = 'approved' and reviewed_by = admin)
     or not exists (select 1 from public.neighborhood_memberships where user_id = resident and neighborhood_id = b and active and verification_status = 'verified')
     or exists (select 1 from public.neighborhood_memberships where user_id = resident and neighborhood_id = a and active)
     or not exists (select 1 from public.neighborhood_verifications where user_id = resident and status = 'verified' and reviewed_by = admin) then
    raise exception 'approval failed to switch membership and record audit';
  end if;

  -- A revoked resident can rejoin but cannot reactivate old verification.
  perform public.admin_revoke_membership(resident, 'Test revocation');
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', resident, 'role', 'authenticated')::text, true);
  membership := public.select_neighborhood(a);
  if membership.verification_status <> 'pending' or membership.verified_at is not null or membership.verified_by is not null then
    raise exception 'historical verification was reactivated';
  end if;
end;
$test$;

rollback;
