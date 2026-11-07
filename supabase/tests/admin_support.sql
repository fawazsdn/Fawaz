-- Admin dashboard functions: staff-only access, status changes, email claim.
-- Self-cleaning (final RAISE rolls back). Expected: "ALL_PASS ...".
do $t$
declare staff uuid := gen_random_uuid(); resident uuid := gen_random_uuid(); web uuid; app uuid; ref text;
  err text; cnt int; passed int := 0; j jsonb; c record;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select u, 'authenticated', 'authenticated', 'adm-test-' || u || '@example.invalid', '00000000-0000-0000-0000-000000000000' from unnest(array[staff, resident]) u;
  update public.profiles set app_role = 'admin', first_name = 'Staff', last_name = 'Member' where id = staff;
  update public.profiles set first_name = 'Rami', last_name = 'Resident' where id = resident;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  ref := public.submit_public_support_request('Sara', 'sara-' || substr(md5(random()::text), 1, 6) || '@example.invalid', 'account', 'Login help', 'I cannot sign in to my account since yesterday.', 'ar');
  -- 1. Anonymous visitors cannot call any admin function.
  begin perform public.admin_support_overview(); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL anon read overview'; end if;
  begin perform public.admin_list_support_requests(); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL anon listed tickets'; end if;
  passed := passed + 1;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', resident, 'role', 'authenticated')::text, true);
  app := public.submit_support_request('bug', 'The map does not load on my phone.');
  -- 2. Residents are refused by every admin function and cannot change status or claim email.
  foreach err in array array['overview', 'list', 'get', 'customers', 'status', 'claim', 'record', 'delivery'] loop
    begin
      case err
        when 'overview' then perform public.admin_support_overview();
        when 'list' then perform public.admin_list_support_requests();
        when 'get' then perform public.admin_get_support_request(app);
        when 'customers' then perform public.admin_support_customers();
        when 'status' then perform public.set_support_request_status(app, 'closed');
        when 'claim' then perform public.claim_support_reply_email(app);
        when 'record' then perform public.record_support_reply_email(app, 'x', true, 'id', null);
        else perform public.update_support_reply_email_status(app, 'id', 'delivered');
      end case;
      raise exception 'FAIL resident allowed: %', err;
    exception when others then
      if sqlerrm like 'FAIL%' then raise; end if;
      if sqlerrm <> 'not_authorized' then raise exception 'FAIL % gave %', err, sqlerrm; end if;
    end;
  end loop;
  passed := passed + 1;

  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  select id into web from public.support_requests where reference = ref;
  -- 3. Staff list, search, filter and read details with names.
  j := public.admin_list_support_requests(p_query => ref);
  if (j->>'total')::int <> 1 then raise exception 'FAIL search by reference %', j->>'total'; end if;
  j := public.admin_list_support_requests(p_source => 'app', p_status => 'open', p_query => 'map does not');
  if (j->>'total')::int < 1 or (j->'rows'->0->>'app_user_name') <> 'Rami Resident' then raise exception 'FAIL app filter %', j; end if;
  j := public.admin_list_support_requests(p_query => '%');
  if (j->>'total')::int <> 0 then raise exception 'FAIL wildcard not escaped'; end if;
  j := public.admin_get_support_request(web);
  if j->>'reference' <> ref or j->>'contact_name' <> 'Sara' then raise exception 'FAIL detail %', j; end if;
  passed := passed + 1;

  -- 4. Status rules: cannot mark answered without a response; respond; close; reopen.
  begin perform public.set_support_request_status(web, 'answered'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:no_response' then raise exception 'FAIL answered without response: %', err; end if;
  begin perform public.respond_support_request(web, '   ', false); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:response' then raise exception 'FAIL empty response: %', err; end if;
  perform public.respond_support_request(web, 'Please try resetting your password from the sign-in screen.', false);
  j := public.admin_get_support_request(web);
  if j->>'status' <> 'answered' or j->>'responder_name' <> 'Staff Member' or j->>'first_responded_at' is null or j->>'email_status' <> 'pending' then
    raise exception 'FAIL respond %', j; end if;
  perform public.set_support_request_status(web, 'closed');
  if (public.admin_get_support_request(web))->>'closed_at' is null then raise exception 'FAIL closed_at'; end if;
  perform public.set_support_request_status(web, 'open');
  j := public.admin_get_support_request(web);
  if j->>'status' <> 'open' or j->>'closed_at' is not null then raise exception 'FAIL reopen %', j; end if;
  passed := passed + 1;

  -- 5. Email: one claim at a time, no duplicate send, failures retryable, provider status recorded.
  select * into c from public.claim_support_reply_email(web);
  if c.attempt <> 1 or c.reference <> ref then raise exception 'FAIL claim %', c; end if;
  begin perform public.claim_support_reply_email(web); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'email:in_progress' then raise exception 'FAIL double claim: %', err; end if;
  perform public.record_support_reply_email(web, c.response_hash, false, null, 'provider 500');
  if (public.admin_get_support_request(web))->>'email_status' <> 'failed' then raise exception 'FAIL failure not recorded'; end if;
  select * into c from public.claim_support_reply_email(web);
  if c.attempt <> 2 then raise exception 'FAIL retry attempt %', c.attempt; end if;
  perform public.record_support_reply_email(web, c.response_hash, true, 'msg_123', null);
  begin perform public.claim_support_reply_email(web); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'email:already_sent' then raise exception 'FAIL resend allowed: %', err; end if;
  begin perform public.record_support_reply_email(web, c.response_hash, true, 'msg_999', null); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'email:not_claimed' then raise exception 'FAIL record without claim: %', err; end if;
  perform public.update_support_reply_email_status(web, 'msg_123', 'delivered');
  perform public.update_support_reply_email_status(web, 'msg_other', 'bounced');
  if (public.admin_get_support_request(web))->>'email_status' <> 'delivered' then raise exception 'FAIL delivery status'; end if;
  -- A changed response can be emailed again.
  perform public.respond_support_request(web, 'Update: we reset your account, please sign in again.', true);
  if (public.admin_get_support_request(web))->>'email_status' <> 'pending' then raise exception 'FAIL new response not pending'; end if;
  begin perform public.claim_support_reply_email(app); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'email:not_applicable' then raise exception 'FAIL app ticket email: %', err; end if;
  passed := passed + 1;

  -- 6. App tickets keep the in-app reply notification.
  perform public.respond_support_request(app, 'Fixed in the next update.', false);
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.notifications where user_id = resident and title_en = 'Support replied';
  if cnt <> 1 then raise exception 'FAIL in-app notification %', cnt; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 7. Overview and customers reflect the data.
  j := public.admin_support_overview('Asia/Riyadh', 30);
  if (j->>'total')::int < 2 or (j->>'today')::int < 2 or jsonb_array_length(j->'series') <> 30 or (j->>'avg_first_response_seconds') is null then
    raise exception 'FAIL overview %', j; end if;
  j := public.admin_support_customers('Rami');
  if (j->>'total')::int <> 1 or (j->'rows'->0->>'tickets')::int <> 1 then raise exception 'FAIL customers %', j; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
