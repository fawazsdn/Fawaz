-- Website support form: anonymous submission, validation, privacy, limits.
-- Self-cleaning (final RAISE rolls back). Expected: "ALL_PASS ...".
do $t$
declare ref text; err text; cnt int; passed int := 0; staff uuid := gen_random_uuid(); resident uuid := gen_random_uuid(); appreq uuid;
  em text := 'visitor-' || substr(md5(random()::text), 1, 8) || '@example.invalid';
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select u, 'authenticated', 'authenticated', 'ps-test-' || u || '@example.invalid', '00000000-0000-0000-0000-000000000000' from unnest(array[staff, resident]) u;
  update public.profiles set app_role = 'admin' where id = staff;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- 1. A visitor can file a ticket and gets a reference.
  ref := public.submit_public_support_request('Sara', em, 'verification', 'Cannot verify', 'The verify button says I am outside my neighborhood.', 'ar');
  if ref !~ '^HR-[0-9A-F]{8}$' then raise exception 'FAIL reference %', ref; end if;
  passed := passed + 1;

  -- 2. Visitors cannot read tickets back or write the table directly.
  begin select count(*) into cnt from public.support_requests; err := null; exception when others then err := sqlerrm; cnt := 0; end;
  if cnt <> 0 then raise exception 'FAIL anon can read tickets'; end if;
  begin insert into public.support_requests(source, contact_email, category, message) values ('website', em, 'other', 'direct insert attempt here');
    err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL anon direct insert'; end if;
  passed := passed + 1;

  -- 3. Server-side validation.
  begin perform public.submit_public_support_request(null, 'not-an-email', 'other', 'Hello', 'A long enough message body here.', 'en'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:email' then raise exception 'FAIL email validation: %', err; end if;
  begin perform public.submit_public_support_request(null, em, 'billing', 'Hello', 'A long enough message body here.', 'en'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:category' then raise exception 'FAIL category validation: %', err; end if;
  begin perform public.submit_public_support_request(null, em, 'other', 'Hello', 'too short', 'en'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:message' then raise exception 'FAIL message validation: %', err; end if;
  passed := passed + 1;

  -- 4. Per-email rate limit (3 per hour).
  perform public.submit_public_support_request(null, upper(em), 'general', 'Second', 'Another question about the app here.', 'en');
  perform public.submit_public_support_request(null, em, 'general', 'Third', 'Another question about the app here.', 'en');
  begin perform public.submit_public_support_request(null, em, 'general', 'Fourth', 'Another question about the app here.', 'en'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'rate_limited' then raise exception 'FAIL rate limit: %', err; end if;
  passed := passed + 1;

  -- 5. Staff see website tickets (and are notified); other residents do not.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', resident, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.support_requests where contact_email = em;
  if cnt <> 0 then raise exception 'FAIL residents see website tickets'; end if;
  appreq := public.submit_support_request('bug', 'The map does not load on my phone.');
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.support_requests where contact_email = em;
  if cnt <> 3 then raise exception 'FAIL staff see % website tickets', cnt; end if;
  select count(*) into cnt from public.notifications where user_id = staff and title_en = 'New website support request';
  if cnt <> 3 then raise exception 'FAIL staff notifications %', cnt; end if;
  -- Staff replies work for both kinds; only app users get an in-app notification.
  perform public.respond_support_request((select id from public.support_requests where reference = ref), 'We replied by email.', true);
  perform public.respond_support_request(appreq, 'Fixed in the next update.', false);
  select count(*) into cnt from public.support_requests where (reference = ref and status = 'closed' and response = 'We replied by email.') or (id = appreq and status = 'answered');
  if cnt <> 2 then raise exception 'FAIL staff replies'; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.notifications where user_id = resident and title_en = 'Support replied';
  if cnt <> 1 then raise exception 'FAIL app user not notified of reply'; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
