-- Clubs: approval workflow, membership, chat access, activities and isolation.
-- Self-cleaning: the final RAISE aborts the transaction, so nothing persists.
-- Expected output: "ALL_PASS ...". Run with: psql "$DATABASE_URL" -f supabase/tests/clubs.sql
do $t$
declare
  owner uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); mem uuid := gen_random_uuid(); minor uuid := gen_random_uuid();
  unver uuid := gen_random_uuid(); outsider uuid := gen_random_uuid(); nbr uuid := gen_random_uuid();
  nb text := 'sa-district-10500227013'; nb2 text := 'sa-district-10500227005';
  app jsonb; c uuid; c2 uuid; ev uuid; ev2 uuid; conv uuid; cnt int; st text; ok boolean; err text; adult boolean; passed int := 0;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select u, 'authenticated', 'authenticated', 'clubs-test-' || u || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[owner, adm, mem, minor, unver, outsider, nbr]) u;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (owner, nb, 'verified', true, now()), (adm, nb, 'verified', true, now()), (mem, nb, 'verified', true, now()),
         (minor, nb, 'verified', true, now()), (outsider, nb2, 'verified', true, now()), (nbr, nb, 'verified', true, now());
  update public.profiles set app_role = 'admin' where id = adm;

  app := jsonb_build_object('name', 'Morning Runners', 'category', 'running',
    'description', 'Easy group runs around the neighborhood park for all levels.',
    'purpose', 'Help neighbors stay active and get to know each other.',
    'planned_activities', 'Weekly 5km runs and a monthly long run.',
    'meeting_frequency', 'weekly',
    'neighborhood_benefit', 'Neighbors meet regularly, exercise together and make the park safer and livelier.',
    'rules', 'Be respectful and punctual. No commercial promotion.',
    'membership_type', 'approval');

  perform set_config('role', 'authenticated', true);

  -- Age declarations (set once, never readable).
  perform set_config('request.jwt.claims', json_build_object('sub', minor, 'role', 'authenticated')::text, true);
  select public.declare_date_of_birth((current_date - interval '15 years')::date) into adult;
  if adult then raise exception 'FAIL minor flagged adult'; end if;
  foreach c in array array[owner, adm, mem, unver, outsider, nbr] loop
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    perform public.declare_date_of_birth(date '1990-01-01');
  end loop;
  c := null;
  ok := false;
  begin select count(*) into cnt from public.age_declarations; ok := cnt = 0; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL date of birth readable (% rows)', cnt; end if;
  passed := passed + 1;

  -- 1. Underage blocked.
  perform set_config('request.jwt.claims', json_build_object('sub', minor, 'role', 'authenticated')::text, true);
  begin perform public.submit_club_application(app); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_adult' then raise exception 'FAIL minor submit: %', err; end if;
  passed := passed + 1;

  -- 2. Unverified blocked.
  perform set_config('request.jwt.claims', json_build_object('sub', unver, 'role', 'authenticated')::text, true);
  begin perform public.submit_club_application(app); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_verified' then raise exception 'FAIL unverified submit: %', err; end if;
  passed := passed + 1;

  -- 3. Weak application rejected by server validation.
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  begin perform public.submit_club_application(app || '{"neighborhood_benefit":"good"}'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:neighborhood_benefit' then raise exception 'FAIL weak benefit accepted: %', err; end if;
  begin perform public.submit_club_application(app || '{"category":"other","custom_category":"   "}'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:custom_category' then raise exception 'FAIL empty custom category accepted: %', err; end if;
  passed := passed + 1;

  -- 4. Valid submission starts pending, client fields like review_status are ignored.
  c := public.submit_club_application(app || '{"review_status":"approved"}');
  select review_status into st from public.community_groups where id = c;
  if st <> 'pending_review' then raise exception 'FAIL initial status %', st; end if;
  passed := passed + 1;

  -- 5. Pending clubs are private to neighbors and not joinable.
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.community_groups where id = c;
  if cnt <> 0 then raise exception 'FAIL pending club visible to neighbor'; end if;
  begin perform public.join_club(c); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'club_unavailable' then raise exception 'FAIL joined pending club: %', err; end if;
  passed := passed + 1;

  -- 6. Applicant cannot self-approve (RPC or direct update); ordinary users cannot approve.
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  begin perform public.review_club(c, 'approved', null); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL owner self-approved'; end if;
  update public.community_groups set review_status = 'approved' where id = c;
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  begin perform public.review_club(c, 'approved', null); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL ordinary user approved'; end if;
  perform set_config('role', 'postgres', true);
  select review_status into st from public.community_groups where id = c;
  perform set_config('role', 'authenticated', true);
  if st <> 'pending_review' then raise exception 'FAIL status changed without admin: %', st; end if;
  passed := passed + 1;

  -- 7. Direct writes are refused.
  ok := false;
  begin insert into public.community_groups(neighborhood_id, owner_id, name, review_status) values (nb, mem, 'Sneaky', 'approved'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL direct club insert allowed'; end if;
  ok := false;
  begin insert into public.group_members(group_id, user_id, role, status) values (c, mem, 'owner', 'active'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL direct membership insert allowed'; end if;
  begin update public.profiles set app_role = 'admin' where id = mem; exception when others then null; end;
  perform set_config('role', 'postgres', true);
  if (select app_role from public.profiles where id = mem) = 'admin' then raise exception 'FAIL self-promotion to admin'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 8. Admin approves; decision recorded; owner notified; duplicate approval refused.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.review_club(c, 'rejected', null); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL rejection without reason'; end if;
  perform public.review_club(c, 'approved', null);
  begin perform public.review_club(c, 'approved', null); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL duplicate approval'; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.club_review_decisions where club_id = c and decision = 'approved' and admin_id = adm;
  if cnt <> 1 then raise exception 'FAIL approval audit rows %', cnt; end if;
  select count(*) into cnt from public.notifications where user_id = owner and deep_link = '/clubs/' || c;
  if cnt < 2 then raise exception 'FAIL owner notifications %', cnt; end if;
  select count(*) into cnt from public.notifications where user_id = adm and deep_link = '/admin/clubs/' || c;
  if cnt <> 1 then raise exception 'FAIL admin not notified of submission'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 9. Approved club discoverable in its neighborhood only.
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.community_groups where id = c;
  if cnt <> 1 then raise exception 'FAIL approved club not visible'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.community_groups where id = c;
  if cnt <> 0 then raise exception 'FAIL cross-neighborhood leak'; end if;
  begin perform public.join_club(c); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL outsider joined'; end if;
  select count(*) into cnt from public.club_member_counts(array[c]);
  if cnt <> 0 then raise exception 'FAIL outsider sees member count'; end if;
  passed := passed + 1;

  -- 10. Join request -> pending -> approved; chat access granted; no duplicate membership.
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  st := public.join_club(c);
  if st <> 'pending' then raise exception 'FAIL join status %', st; end if;
  st := public.join_club(c);
  perform set_config('request.jwt.claims', json_build_object('sub', minor, 'role', 'authenticated')::text, true);
  perform public.join_club(c);
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.group_members where group_id = c and status = 'pending';
  if cnt <> 2 then raise exception 'FAIL organizer sees % pending requests', cnt; end if;
  perform public.respond_join_request(c, mem, true);
  perform public.respond_join_request(c, minor, true);
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.group_members where group_id = c and user_id = mem;
  if cnt <> 1 then raise exception 'FAIL duplicate membership rows'; end if;
  select id into conv from public.conversations where group_id = c;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  insert into public.messages(conversation_id, sender_id, body) values (conv, mem, 'Hello club');
  perform set_config('request.jwt.claims', json_build_object('sub', nbr, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.messages where conversation_id = conv;
  if cnt <> 0 then raise exception 'FAIL non-member reads club chat'; end if;
  ok := false;
  begin insert into public.messages(conversation_id, sender_id, body) values (conv, nbr, 'hi'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL non-member wrote to club chat'; end if;
  passed := passed + 1;

  -- 11. Permissions: members cannot moderate; minors cannot be moderators; owner cannot be removed.
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  begin perform public.remove_club_member(c, minor, false); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL member removed member: %', err; end if;
  begin perform public.create_club_activity(c, '{}'::jsonb); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL member created activity: %', err; end if;
  begin perform public.set_member_role(c, mem, 'moderator'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL self-promotion: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  begin perform public.set_member_role(c, minor, 'moderator'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_adult' then raise exception 'FAIL minor promoted: %', err; end if;
  perform public.set_member_role(c, mem, 'moderator');
  begin perform public.leave_club(c); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'owner_must_transfer' then raise exception 'FAIL owner left: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  begin perform public.remove_club_member(c, owner, true); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'cannot_remove_owner' then raise exception 'FAIL moderator removed owner: %', err; end if;
  passed := passed + 1;

  -- 12. Recurring activity: 4 weekly occurrences, one series, one notification per member.
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  ev := public.create_club_activity(c, jsonb_build_object('title', 'Saturday run', 'category', 'running',
    'starts_at', now() + interval '2 days', 'ends_at', now() + interval '2 days 1 hour', 'capacity', 15,
    'recurrence', 'weekly', 'occurrences', 4, 'members_only', true, 'location_label', 'Park gate'));
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.events where series_id = (select series_id from public.events where id = ev);
  if cnt <> 4 then raise exception 'FAIL occurrences %', cnt; end if;
  select count(*) into cnt from public.events e where e.series_id = (select series_id from public.events where id = ev)
    and e.starts_at - (select starts_at from public.events where id = ev) not in (interval '0', interval '7 days', interval '14 days', interval '21 days');
  if cnt <> 0 then raise exception 'FAIL weekly spacing'; end if;
  select count(*) into cnt from public.notifications where user_id = mem and title_en like 'New activity in%';
  if cnt <> 1 then raise exception 'FAIL member got % activity notifications', cnt; end if;
  select count(*) into cnt from public.event_attendees a join public.events e on e.id = a.event_id where e.series_id = (select series_id from public.events where id = ev) and a.user_id = owner;
  if cnt <> 4 then raise exception 'FAIL host attendance rows %', cnt; end if;
  select id into ev2 from public.events where series_id = (select series_id from public.events where id = ev) order by starts_at offset 1 limit 1;
  perform set_config('role', 'authenticated', true);
  -- Members-only: a verified neighbor who is not a member cannot RSVP.
  perform set_config('request.jwt.claims', json_build_object('sub', nbr, 'role', 'authenticated')::text, true);
  begin perform public.rsvp_event(ev, 'going'); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL non-member joined members-only activity'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  perform public.rsvp_event(ev2, 'going');
  perform public.rsvp_event(ev2, 'going');
  select count(*) into cnt from public.event_attendees where event_id = ev2 and user_id = mem;
  if cnt <> 1 then raise exception 'FAIL duplicate registration'; end if;
  -- Moderator edits the future series; owner cancels from the 2nd occurrence.
  perform public.update_club_activity(ev2, '{"title":"Saturday long run"}'::jsonb, 'future');
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  cnt := public.cancel_club_activity(ev2, 'future');
  if cnt <> 3 then raise exception 'FAIL cancelled %', cnt; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.notifications where user_id = mem and title_en = 'Activity cancelled';
  if cnt <> 1 then raise exception 'FAIL cancel notifications %', cnt; end if;
  select count(*) into cnt from public.events where id = ev and cancelled_at is null and title = 'Saturday run';
  if cnt <> 1 then raise exception 'FAIL first occurrence changed'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 13. Ban removes chat access immediately and blocks rejoining.
  perform public.remove_club_member(c, minor, true);
  perform set_config('request.jwt.claims', json_build_object('sub', minor, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.messages where conversation_id = conv;
  if cnt <> 0 then raise exception 'FAIL banned member reads chat'; end if;
  ok := false;
  begin insert into public.messages(conversation_id, sender_id, body) values (conv, minor, 'still here?'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL banned member wrote'; end if;
  begin perform public.join_club(c); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'banned' then raise exception 'FAIL banned rejoin: %', err; end if;
  passed := passed + 1;

  -- 14. Ownership transfer keeps exactly one owner.
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  begin perform public.transfer_club_ownership(c, minor); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL transfer to banned minor'; end if;
  perform public.transfer_club_ownership(c, mem);
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.group_members where group_id = c and role = 'owner' and status = 'active';
  if cnt <> 1 or (select owner_id from public.community_groups where id = c) <> mem then raise exception 'FAIL transfer'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 15. Suspended club: no joins, read-only chat, no new activities.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.review_club(c, 'suspended', 'Reported for spam, under review');
  perform set_config('request.jwt.claims', json_build_object('sub', nbr, 'role', 'authenticated')::text, true);
  begin perform public.join_club(c); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'club_unavailable' then raise exception 'FAIL joined suspended club: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  ok := false;
  begin insert into public.messages(conversation_id, sender_id, body) values (conv, mem, 'x'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL suspended chat writable'; end if;
  begin perform public.create_club_activity(c, '{}'::jsonb); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'club_unavailable' then raise exception 'FAIL activity in suspended club: %', err; end if;
  passed := passed + 1;

  -- 16. Rejected application: not joinable; applicant can see it and the reason. Admin cannot approve own club.
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  c2 := public.submit_club_application(app || '{"name":"Chess Corner","category":"chess"}');
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.review_club(c2, 'needs_changes', 'Please describe where you will meet');
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  perform public.update_club(c2, app || '{"name":"Chess Corner","category":"chess","meeting_location":"Community hall"}');
  select review_status into st from public.community_groups where id = c2;
  if st <> 'pending_review' then raise exception 'FAIL resubmit status %', st; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.review_club(c2, 'rejected', 'Duplicate of an existing club');
  perform set_config('request.jwt.claims', json_build_object('sub', mem, 'role', 'authenticated')::text, true);
  begin perform public.join_club(c2); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'club_unavailable' then raise exception 'FAIL joined rejected club: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.club_review_decisions where club_id = c2;
  if cnt <> 4 then raise exception 'FAIL applicant sees % decisions', cnt; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  c2 := public.submit_club_application(app || '{"name":"Admin Club"}');
  begin perform public.review_club(c2, 'approved', null); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL admin approved own club'; end if;
  passed := passed + 1;

  -- 17. Submission rate limit (max 2 open applications).
  perform set_config('request.jwt.claims', json_build_object('sub', nbr, 'role', 'authenticated')::text, true);
  perform public.submit_club_application(app || '{"name":"Club A"}');
  perform public.submit_club_application(app || '{"name":"Club B"}');
  begin perform public.submit_club_application(app || '{"name":"Club C"}'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'rate_limited' then raise exception 'FAIL rate limit: %', err; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
