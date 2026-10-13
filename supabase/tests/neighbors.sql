-- Neighbors: opt-in discovery, mutual connections, privacy, messaging gate,
-- invitations and blocking. Self-cleaning: the final RAISE aborts the
-- transaction. Expected output: "ALL_PASS ...".
-- Run with: psql "$DATABASE_URL" -f supabase/tests/neighbors.sql
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); o uuid := gen_random_uuid();
  nb text := 'sa-district-10500227013'; nb2 text := 'sa-district-10500227005';
  st text; err text; cnt int; req uuid; conv uuid; ev uuid; inv uuid; ok boolean; passed int := 0;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select u, 'authenticated', 'authenticated', 'nb-test-' || u || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[a, b, c, o]) u;
  update public.profiles set first_name = 'Test', last_name = 'Person', profile_completed = true where id in (a, b, c, o);
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (a, nb, 'verified', true, now()), (b, nb, 'verified', true, now()), (c, nb, 'verified', true, now()), (o, nb2, 'verified', true, now());
  perform set_config('role', 'authenticated', true);

  -- 1. Registering alone never lists you: no directory enumeration, no discovery.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.profiles where id in (b, c);
  if cnt <> 0 then raise exception 'FAIL profiles enumerable without opt-in (% rows)', cnt; end if;
  select count(*) into cnt from public.discover_neighbors(null, 50);
  if cnt <> 0 then raise exception 'FAIL discovery shows non-opted-in residents'; end if;
  passed := passed + 1;

  -- 2. Opting in makes you discoverable to your own neighborhood only; settings stay private.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.update_neighbor_settings('{"discoverable": true, "show_interests": false}');
  perform public.set_my_interests(array['padel', 'coffee']);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.discover_neighbors(null, 50) d where d.user_id = b;
  if cnt <> 1 then raise exception 'FAIL opted-in neighbor not discoverable'; end if;
  select count(*) into cnt from public.discover_neighbors(null, 50) d where d.user_id = c;
  if cnt <> 0 then raise exception 'FAIL non-opted-in neighbor discoverable'; end if;
  select count(*) into cnt from public.neighbor_settings where user_id = b;
  if cnt <> 0 then raise exception 'FAIL neighbor settings readable by others'; end if;
  select count(*) into cnt from public.user_interests where user_id = b;
  if cnt <> 0 then raise exception 'FAIL hidden interests readable'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.discover_neighbors(null, 50);
  if cnt <> 0 then raise exception 'FAIL cross-neighborhood discovery'; end if;
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 0 then raise exception 'FAIL cross-neighborhood profile read'; end if;
  passed := passed + 1;

  -- 3. Writes only through RPCs: no forged rows.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ok := false;
  begin insert into public.neighbor_connections(user_a, user_b) values (least(a, c), greatest(a, c)); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL direct connection insert allowed'; end if;
  ok := false;
  begin insert into public.neighbor_requests(requester_id, recipient_id, status) values (c, a, 'accepted'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL direct request insert allowed'; end if;
  passed := passed + 1;

  -- 4. No self-requests, no cross-neighborhood requests.
  begin perform public.send_neighbor_request(a); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL self-request accepted'; end if;
  begin perform public.send_neighbor_request(o); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_verified' then raise exception 'FAIL cross-neighborhood request: %', err; end if;
  passed := passed + 1;

  -- 5. A request is idempotent and never duplicated in either direction.
  st := public.send_neighbor_request(b);
  if st <> 'request_sent' then raise exception 'FAIL first request %', st; end if;
  st := public.send_neighbor_request(b);
  if st <> 'request_sent' then raise exception 'FAIL duplicate request %', st; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  st := public.send_neighbor_request(a);
  if st <> 'request_received' then raise exception 'FAIL reverse request should surface the incoming one: %', st; end if;
  select count(*) into cnt from public.neighbor_requests where status = 'pending' and a in (requester_id, recipient_id) and b in (requester_id, recipient_id);
  if cnt <> 1 then raise exception 'FAIL % pending requests for one pair', cnt; end if;
  select id into req from public.neighbor_requests where requester_id = a and recipient_id = b and status = 'pending';
  passed := passed + 1;

  -- 6. A request alone grants nothing: not connected, no messaging.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.start_direct_conversation(b, null, null); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_connected' then raise exception 'FAIL messaging before acceptance: %', err; end if;
  begin perform public.get_or_create_direct_conversation(b); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_connected' then raise exception 'FAIL legacy messaging path before acceptance: %', err; end if;
  passed := passed + 1;

  -- 7. Forged acceptance: neither the requester nor a third party can accept.
  begin perform public.respond_neighbor_request(req, true); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL requester accepted own request: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin perform public.respond_neighbor_request(req, true); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_authorized' then raise exception 'FAIL third party accepted: %', err; end if;
  select count(*) into cnt from public.neighbor_requests where id = req;
  if cnt <> 0 then raise exception 'FAIL third party can see the request'; end if;
  passed := passed + 1;

  -- 8. Recipient accepts → mutual connection, visible only to the two of them.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  st := public.respond_neighbor_request(req, true);
  if st <> 'accepted' then raise exception 'FAIL accept %', st; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.neighbor_connections;
  if cnt <> 1 then raise exception 'FAIL requester sees % connections', cnt; end if;
  if (public.neighbor_profile(b)->>'state') <> 'connected' then raise exception 'FAIL state not connected'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.neighbor_connections;
  if cnt <> 0 then raise exception 'FAIL private neighbor list visible to others'; end if;
  if (public.neighbor_profile(b)->>'neighbor_count') is not null then raise exception 'FAIL neighbor count shown without permission'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.notifications where user_id = b and type = 'neighbor_request';
  if cnt <> 1 then raise exception 'FAIL recipient notifications %', cnt; end if;
  passed := passed + 1;

  -- 9. Connected neighbors can message.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select id into conv from public.start_direct_conversation(b, null, null);
  insert into public.messages(conversation_id, sender_id, body) values (conv, a, 'Salam neighbor');
  passed := passed + 1;

  -- 10. Activity invitations: only connected neighbors, no duplicates, no auto-enrolment.
  insert into public.events(neighborhood_id, host_id, title, category, description, starts_at, ends_at, location_label, capacity, audience)
  values (nb, a, 'Evening walk', 'walking', '', now() + interval '1 day', now() + interval '1 day 1 hour', 'Park', 10, 'neighborhood')
  returning id into ev;
  cnt := public.invite_neighbors_to_event(ev, array[b, c]);
  if cnt <> 1 then raise exception 'FAIL invited % (non-neighbor must be skipped)', cnt; end if;
  cnt := public.invite_neighbors_to_event(ev, array[b]);
  if cnt <> 0 then raise exception 'FAIL duplicate invitation'; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.event_attendees where event_id = ev and user_id = b;
  if cnt <> 0 then raise exception 'FAIL invitee auto-enrolled'; end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select id into inv from public.event_invitations where event_id = ev and invitee_id = b;
  st := public.respond_event_invitation(inv, true);
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.event_attendees where event_id = ev and user_id = b and status = 'going';
  if cnt <> 1 then raise exception 'FAIL accepted invitation did not RSVP'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 11. Blocking ends the connection, the thread and further requests.
  insert into public.user_blocks(blocker_id, blocked_id) values (b, a);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.neighbor_connections;
  if cnt <> 0 then raise exception 'FAIL connection survived a block'; end if;
  ok := false;
  begin insert into public.messages(conversation_id, sender_id, body) values (conv, a, 'still there?'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL blocked user can still message'; end if;
  begin perform public.send_neighbor_request(b); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'unavailable' then raise exception 'FAIL request to blocker: %', err; end if;
  passed := passed + 1;

  -- 12. Requests can be switched off, and repeated request spam is rate-limited.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.update_neighbor_settings('{"allow_requests": false}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.send_neighbor_request(c); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'requests_closed' then raise exception 'FAIL closed requests: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.update_neighbor_settings('{"allow_requests": true}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.send_neighbor_request(c);
  perform public.cancel_neighbor_request(c);
  perform public.send_neighbor_request(c);
  perform public.cancel_neighbor_request(c);
  begin perform public.send_neighbor_request(c); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'rate_limited' then raise exception 'FAIL request spam not limited: %', err; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
