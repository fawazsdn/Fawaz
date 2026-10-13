-- Compliance backend: content filter, support requests, manual verification.
-- Self-cleaning (final RAISE rolls back). Expected: "ALL_PASS ...".
do $t$
declare a uuid := gen_random_uuid(); x uuid := gen_random_uuid(); nb text := 'sa-district-10500227013';
  err text; ok boolean; cnt int; passed int := 0; req uuid;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select u, 'authenticated', 'authenticated', 'cmp-test-' || u || '@example.invalid', '00000000-0000-0000-0000-000000000000' from unnest(array[a, x]) u;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at) values (a, nb, 'verified', true, now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 1. Objectionable text is refused server-side; normal text is accepted.
  ok := false;
  begin insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', a, nb, 'يا شرموطة', 'neighborhood');
  exception when others then ok := sqlerrm = 'content_blocked'; end;
  if not ok then raise exception 'FAIL blocked term accepted in a post'; end if;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', a, nb, 'مرحبا يا جيران، فيه أحد يلعب بادل الليلة؟', 'neighborhood');
  ok := false;
  begin update public.profiles set bio = 'what the FUCK' where id = a; exception when others then ok := sqlerrm = 'content_blocked'; end;
  if not ok then raise exception 'FAIL blocked term accepted in a bio'; end if;
  passed := passed + 1;

  -- 2. The term list is admin-only.
  select count(*) into cnt from public.moderation_terms;
  if cnt <> 0 then raise exception 'FAIL term list readable by residents'; end if;
  begin perform public.admin_add_moderation_term('test'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL resident edited term list'; end if;
  passed := passed + 1;

  -- 3. Support requests: residents can file and see only their own.
  req := public.submit_support_request('bug', 'The map does not load on my phone.');
  select count(*) into cnt from public.support_requests;
  if cnt <> 1 then raise exception 'FAIL own support request not visible'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.support_requests;
  if cnt <> 0 then raise exception 'FAIL other residents see support requests'; end if;
  begin perform public.respond_support_request(req, 'hi', false); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL resident answered support request'; end if;
  passed := passed + 1;

  -- 4. Manual verification is admin-only — no client bypass of location verification.
  begin perform public.admin_verify_member(x, nb, 'self-verify attempt'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL resident self-verified: %', err; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.neighborhood_memberships where user_id = x and verification_status = 'verified';
  if cnt <> 0 then raise exception 'FAIL membership created'; end if;
  -- Database maintenance (SQL editor) can, and it is audited.
  perform public.admin_verify_member(x, nb, 'App Review account');
  select count(*) into cnt from public.neighborhood_verifications where user_id = x and method = 'manual' and status = 'verified';
  if cnt <> 1 then raise exception 'FAIL manual verification not audited'; end if;
  perform public.admin_revoke_membership(x, 'review finished');
  select count(*) into cnt from public.neighborhood_memberships where user_id = x and active;
  if cnt <> 0 then raise exception 'FAIL revoke'; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
