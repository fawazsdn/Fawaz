-- RLS/RPC test for poll vote changes. Self-cleaning: the final RAISE aborts
-- the transaction, so nothing persists. Expected output: "ALL_PASS ...".
-- Run with: psql "$DATABASE_URL" -f supabase/tests/poll_vote_change.sql
do $t$
declare u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); nb text := 'sa-district-10500227013';
  p public.polls; oa uuid; ob uuid; cnt int; tot int; seen int; ok boolean;
begin
  insert into auth.users(id, aud, role, email, instance_id) values
    (u1,'authenticated','authenticated','rls-test-1@example.invalid','00000000-0000-0000-0000-000000000000'),
    (u2,'authenticated','authenticated','rls-test-2@example.invalid','00000000-0000-0000-0000-000000000000');
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
    values (u1,nb,'verified',true,now()),(u2,nb,'verified',true,now());
  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select * into p from public.create_poll('RLS test?', array['A','B'], 24);
  select id into oa from public.poll_options where poll_id=p.id and position=0;
  select id into ob from public.poll_options where poll_id=p.id and position=1;
  perform public.vote_in_poll(p.id, oa);
  perform public.vote_in_poll(p.id, ob);
  select count(*) into cnt from public.poll_votes where poll_id=p.id;
  select total_votes into tot from public.polls where id=p.id;
  if cnt <> 1 or tot <> 1 then raise exception 'FAIL change counted twice cnt=% tot=%', cnt, tot; end if;
  select vote_count into cnt from public.get_poll_results(array[p.id]) where option_id=ob;
  if cnt <> 1 then raise exception 'FAIL B count %', cnt; end if;
  select vote_count into cnt from public.get_poll_results(array[p.id]) where option_id=oa;
  if cnt <> 0 then raise exception 'FAIL A count %', cnt; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  perform public.vote_in_poll(p.id, oa);
  select count(*) into seen from public.poll_votes where poll_id=p.id;
  if seen <> 1 then raise exception 'FAIL privacy: u2 sees % vote rows', seen; end if;
  ok := false;
  begin insert into public.poll_votes(poll_id, option_id, user_id) values (p.id, ob, u2); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL direct insert allowed'; end if;
  perform set_config('role','postgres', true);
  update public.polls set created_at = now()-interval '2 hours', closes_at = now()-interval '1 minute' where id=p.id;
  perform set_config('role','authenticated', true);
  ok := false;
  begin perform public.vote_in_poll(p.id, ob); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL closed poll accepted vote'; end if;
  raise exception 'ALL_PASS total=% (rolled back)', (select total_votes from public.polls where id=p.id);
end $t$;
