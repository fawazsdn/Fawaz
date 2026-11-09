-- Neighborhood locking and change requests: adversarial checks.
-- Self-cleaning (final RAISE rolls back). Expected: "ALL_PASS ...".
do $t$
declare
  res uuid := gen_random_uuid(); fresh uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  adm uuid := gen_random_uuid(); adm2 uuid := gen_random_uuid();
  a text := 'sa-district-10500227013'; b text := 'sa-district-10500227005'; c text := 'sa-district-10100003001';
  err text; cnt int; passed int := 0; req uuid; req2 uuid; req3 uuid; j jsonb; m record;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select u, 'authenticated', 'authenticated', 'lock-test-' || u || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[res, fresh, other, adm, adm2]) u;
  update public.profiles set first_name = 'Test', last_name = 'Resident' where id in (res, fresh, other);
  update public.profiles set app_role = 'admin', first_name = 'Lock', last_name = 'Admin' where id in (adm, adm2);
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (res, a, 'verified', true, now()), (other, a, 'verified', true, now()), (adm, a, 'verified', true, now());
  perform set_config('role', 'authenticated', true);

  -- 1. A verified resident cannot switch neighborhoods through select_neighborhood.
  perform set_config('request.jwt.claims', json_build_object('sub', res, 'role', 'authenticated')::text, true);
  begin perform public.select_neighborhood(b); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'neighborhood_locked' then raise exception 'FAIL verified user switched: %', err; end if;
  perform public.select_neighborhood(a);  -- same neighborhood: harmless no-op
  select count(*) into cnt from public.neighborhood_memberships where user_id = res and active and neighborhood_id = a and verification_status = 'verified';
  if cnt <> 1 then raise exception 'FAIL membership changed after locked attempt'; end if;
  passed := passed + 1;

  -- 2. Direct table writes are impossible for API users.
  begin update public.neighborhood_memberships set active = false where user_id = res; err := null; exception when others then err := sqlerrm; end;
  if err is null then
    select count(*) into cnt from public.neighborhood_memberships where user_id = res and active;
    if cnt <> 1 then raise exception 'FAIL direct update deactivated membership'; end if;
  end if;
  begin insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at) values (res, b, 'verified', false, now());
    err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL direct insert allowed'; end if;
  begin insert into public.neighborhood_change_requests(user_id, from_neighborhood_id, to_neighborhood_id, reason, status) values (res, a, b, 'forged approved request', 'approved');
    err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL direct request insert allowed'; end if;
  passed := passed + 1;

  -- 3. Even a privileged SQL path is blocked by the trigger unless an admin function approved it.
  perform set_config('role', 'postgres', true);
  begin update public.neighborhood_memberships set active = false where user_id = res and active; err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'neighborhood_locked' then raise exception 'FAIL trigger did not block: %', err; end if;
  begin update public.neighborhood_memberships set neighborhood_id = b where user_id = res and active; err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'neighborhood_locked' then raise exception 'FAIL trigger allowed move: %', err; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 4. Onboarding is unchanged for residents without a verified neighborhood.
  perform set_config('request.jwt.claims', json_build_object('sub', fresh, 'role', 'authenticated')::text, true);
  perform public.select_neighborhood(a);
  perform public.select_neighborhood(b);
  select count(*) into cnt from public.neighborhood_memberships where user_id = fresh and active and neighborhood_id = b and verification_status = 'pending';
  if cnt <> 1 then raise exception 'FAIL unverified user could not choose'; end if;
  begin perform public.request_neighborhood_change(c, 'I am moving to a new home soon.'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_verified' then raise exception 'FAIL unverified change request: %', err; end if;
  passed := passed + 1;

  -- 5. Change requests: validation, one pending at a time, current membership stays active.
  perform set_config('request.jwt.claims', json_build_object('sub', res, 'role', 'authenticated')::text, true);
  begin perform public.request_neighborhood_change(a, 'Same neighborhood request.'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:same_neighborhood' then raise exception 'FAIL same nb: %', err; end if;
  begin perform public.request_neighborhood_change(b, 'short'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:reason' then raise exception 'FAIL short reason: %', err; end if;
  req := public.request_neighborhood_change(b, 'We moved to a new apartment in this neighborhood.');
  begin perform public.request_neighborhood_change(c, 'Another request while one is pending.'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'request_pending' then raise exception 'FAIL second pending: %', err; end if;
  select count(*) into cnt from public.neighborhood_memberships where user_id = res and active and neighborhood_id = a and verification_status = 'verified';
  if cnt <> 1 then raise exception 'FAIL current membership changed while pending'; end if;
  begin perform public.select_neighborhood(b); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'neighborhood_locked' then raise exception 'FAIL pending request unlocked select'; end if;
  passed := passed + 1;

  -- 6. Residents cannot decide, list or see other residents' requests.
  begin perform public.admin_decide_neighborhood_change(req, true, null); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL resident approved own request: %', err; end if;
  begin perform public.admin_list_neighborhood_change_requests(); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL resident listed requests: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.neighborhood_change_requests where id = req;
  if cnt <> 0 then raise exception 'FAIL other resident sees request'; end if;
  begin perform public.cancel_neighborhood_change_request(req); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not found' then raise exception 'FAIL other resident cancelled: %', err; end if;
  passed := passed + 1;

  -- 7. Admins cannot approve their own request.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  req2 := public.request_neighborhood_change(c, 'Admin moving house, needs another admin.');
  begin perform public.admin_decide_neighborhood_change(req2, true, 'self'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'cannot_decide_own_request' then raise exception 'FAIL admin self-approval: %', err; end if;
  passed := passed + 1;

  -- 8. Approval moves the membership atomically and is audited.
  j := public.admin_list_neighborhood_change_requests('pending');
  if (j->>'pending')::int < 2 or j->'rows'->0->>'reason' is null then raise exception 'FAIL admin list %', j; end if;
  perform public.admin_decide_neighborhood_change(req, true, 'Verified the new lease.');
  select * into m from public.neighborhood_memberships where user_id = res and active;
  if m.neighborhood_id <> b or m.verification_status <> 'verified' or m.verified_by <> adm then raise exception 'FAIL approval did not move membership %', m; end if;
  select count(*) into cnt from public.neighborhood_memberships where user_id = res and neighborhood_id = a and not active;
  if cnt <> 1 then raise exception 'FAIL old membership not deactivated'; end if;
  select count(*) into cnt from public.neighborhood_verifications where user_id = res and method = 'manual' and status = 'verified' and reviewed_by = adm;
  if cnt <> 1 then raise exception 'FAIL approval not audited'; end if;
  begin perform public.admin_decide_neighborhood_change(req, false, 'again'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'already_decided' then raise exception 'FAIL decided twice: %', err; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.notifications where user_id = res and title_en = 'Neighborhood change approved';
  if cnt <> 1 then raise exception 'FAIL resident not notified'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 9. Rejection preserves the verified neighborhood; the other admin decides the admin's request.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  req3 := public.request_neighborhood_change(c, 'I would like to join my family in this district.');
  perform set_config('request.jwt.claims', json_build_object('sub', adm2, 'role', 'authenticated')::text, true);
  perform public.admin_decide_neighborhood_change(req3, false, 'Please verify in person first.');
  perform public.admin_decide_neighborhood_change(req2, false, null);
  select count(*) into cnt from public.neighborhood_memberships where user_id = other and active and neighborhood_id = a and verification_status = 'verified';
  if cnt <> 1 then raise exception 'FAIL rejection changed membership'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.neighborhood_change_requests where id = req3 and status = 'rejected' and decision_note = 'Please verify in person first.';
  if cnt <> 1 then raise exception 'FAIL resident cannot see own decision'; end if;
  passed := passed + 1;

  -- 10. Stale requests (membership changed meanwhile) are refused; cancel works for the owner.
  perform set_config('request.jwt.claims', json_build_object('sub', res, 'role', 'authenticated')::text, true);
  req := public.request_neighborhood_change(a, 'Moving back to my old neighborhood.');
  perform public.cancel_neighborhood_change_request(req);
  select count(*) into cnt from public.neighborhood_change_requests where id = req and status = 'cancelled';
  if cnt <> 1 then raise exception 'FAIL cancel'; end if;
  req := public.request_neighborhood_change(c, 'Moving again for a new job nearby.');
  perform set_config('role', 'postgres', true);
  perform public.admin_verify_member(res, a, 'manual move for stale test');
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.admin_decide_neighborhood_change(req, true, null); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'stale_request' then raise exception 'FAIL stale approval: %', err; end if;
  passed := passed + 1;

  -- 11. Anonymous callers and hardening.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.request_neighborhood_change(b, 'anonymous attempt here'); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL anon request'; end if;
  begin perform public.select_neighborhood(b); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL anon select'; end if;
  perform set_config('role', 'postgres', true);
  if has_table_privilege('authenticated', 'public.posts', 'TRUNCATE') or has_table_privilege('anon', 'public.neighborhood_memberships', 'TRUNCATE') then
    raise exception 'FAIL truncate still granted';
  end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
