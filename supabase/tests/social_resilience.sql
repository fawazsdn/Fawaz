-- Social resilience (20261110090000): idempotent publish/comment and the
-- photo publication/cleanup guard. Synthetic accounts only. Self-cleaning:
-- the final RAISE aborts the transaction. Expected output: "ALL_PASS ...".
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
  nb text := 'sa-district-10500227013';
  op uuid := gen_random_uuid(); op2 uuid := gen_random_uuid(); cop uuid := gen_random_uuid();
  r jsonb; r2 jsonb; cnt int; ok boolean; err text; passed int := 0;
  p1 text; p2 text; p3 text; stale text; post_id uuid; c_id uuid;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select x, 'authenticated', 'authenticated', 'res-' || x || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[a, b, u]) x;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (a, nb, 'verified', true, now()), (b, nb, 'verified', true, now());
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active) values (u, nb, 'pending', true);
  p1 := 'posts/' || a || '/1.jpg'; p2 := 'posts/' || a || '/2.jpg'; p3 := 'posts/' || a || '/3.jpg';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- Upload a batch of three photos the way the app does (file, then record).
  insert into storage.objects(bucket_id, name, owner_id) values ('community-media', p1, a::text), ('community-media', p2, a::text), ('community-media', p3, a::text);
  insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes, status)
  values (a, nb, 'community-media', p1, 'image/jpeg', 10, 'attached'),   -- client can't pre-attach: forced to staged
         (a, nb, 'community-media', p2, 'image/jpeg', 10, 'staged'),
         (a, nb, 'community-media', p3, 'image/jpeg', 10, 'staged');
  select count(*) into cnt from public.media_attachments where owner_id = a and status = 'staged';
  if cnt <> 3 then raise exception 'FAIL uploads not staged (%)', cnt; end if;
  ok := false;
  begin insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes)
        values (a, nb, 'community-media', 'posts/' || b || '/x.jpg', 'image/jpeg', 10); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL recorded an upload in another account''s folder'; end if;
  passed := passed + 1;

  -- 1. First publish creates; a retry after a lost response returns the same post; no duplicate.
  r := public.publish_post(op, 'general', 'hello', 'public', array[p1, p2]);
  if r->>'outcome' <> 'created' then raise exception 'FAIL first publish %', r; end if;
  post_id := (r->>'post_id')::uuid;
  r2 := public.publish_post(op, 'general', 'hello', 'public', array[p1, p2]);
  if r2->>'outcome' <> 'existing' or r2->>'post_id' <> r->>'post_id' then raise exception 'FAIL retry not reconciled %', r2; end if;
  select count(*) into cnt from public.posts where author_id = a;
  if cnt <> 1 then raise exception 'FAIL duplicate post (%)', cnt; end if;
  select count(*) into cnt from public.media_attachments where object_path in (p1, p2) and status = 'attached' and entity_id = post_id;
  if cnt <> 2 then raise exception 'FAIL photos not attached to the post'; end if;
  passed := passed + 1;

  -- 2. Same op id with a different payload never writes a second post.
  r2 := public.publish_post(op, 'general', 'edited text', 'public', array[p1, p2]);
  if r2->>'outcome' <> 'conflict' then raise exception 'FAIL payload mismatch accepted %', r2; end if;
  select count(*) into cnt from public.posts where author_id = a;
  if cnt <> 1 then raise exception 'FAIL conflict created a post'; end if;
  passed := passed + 1;

  -- 3. Another account reusing the same op id gets its own post; it can't see or reconcile a's.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  r2 := public.publish_post(op, 'general', 'hello', 'public', '{}');
  if r2->>'outcome' <> 'created' or r2->>'post_id' = r->>'post_id' then raise exception 'FAIL cross-account op id collision %', r2; end if;
  -- ...and can't publish a's photos (staged or attached).
  begin perform public.publish_post(gen_random_uuid(), 'general', 'x', 'public', array[p3]); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:images' then raise exception 'FAIL other account used a''s photo: %', err; end if;
  -- ...or delete them.
  delete from storage.objects where name in (p1, p3);
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from storage.objects where name in (p1, p3);
  if cnt <> 2 then raise exception 'FAIL other account deleted a''s photos'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 4. The owner can't delete a photo a live post references (even after a lost response),
  --    but can delete an unused staged one.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from storage.objects where bucket_id = 'community-media' and name = p1;
  delete from public.media_attachments where object_path = p1;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from storage.objects where name = p1;
  if cnt <> 1 then raise exception 'FAIL owner deleted a referenced photo file'; end if;
  select count(*) into cnt from public.media_attachments where object_path = p1;
  if cnt <> 1 then raise exception 'FAIL owner dropped a referenced photo record'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 5. Publishing a photo whose file is gone (or never recorded) fails; nothing is half-written.
  delete from storage.objects where name = p3;   -- unused, staged: allowed
  begin perform public.publish_post(op2, 'general', 'x', 'public', array[p3]); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'photo_unavailable' then raise exception 'FAIL published a deleted photo: %', err; end if;
  begin perform public.publish_post(op2, 'general', 'x', 'public', array['posts/' || a || '/never.jpg']); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'photo_unavailable' then raise exception 'FAIL published an unrecorded photo: %', err; end if;
  -- direct inserts go through the same guard
  begin insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, image_paths)
        values ('general', a, nb, 'direct', 'public', array['posts/' || a || '/never.jpg']); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'photo_unavailable' then raise exception 'FAIL direct insert bypassed the guard: %', err; end if;
  select count(*) into cnt from public.posts where author_id = a;
  if cnt <> 1 then raise exception 'FAIL partial post written'; end if;
  passed := passed + 1;

  -- 6. Cleanup (service role) claims only abandoned staged uploads, never referenced ones,
  --    and a claimed photo can't be published.
  perform set_config('role', 'postgres', true);
  stale := 'posts/' || a || '/stale.jpg';
  insert into storage.objects(bucket_id, name, owner_id) values ('community-media', stale, a::text);
  insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes, created_at)
  values (a, nb, 'community-media', stale, 'image/jpeg', 10, now() - interval '2 days');
  update public.media_attachments set created_at = now() - interval '2 days' where object_path in (p1, p2);
  select count(*) into cnt from public.claim_abandoned_post_photos(interval '24 hours', 100) c where c.object_path in (p1, p2);
  if cnt <> 0 then raise exception 'FAIL cleanup claimed referenced photos'; end if;
  select count(*) into cnt from public.media_attachments where object_path = stale and status = 'deleting';
  if cnt <> 1 then raise exception 'FAIL cleanup did not claim the abandoned upload'; end if;
  perform set_config('role', 'authenticated', true);
  begin perform public.publish_post(gen_random_uuid(), 'general', 'late', 'public', array[stale]); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'photo_unavailable' then raise exception 'FAIL published a photo claimed by cleanup: %', err; end if;
  perform set_config('role', 'postgres', true);
  delete from storage.objects where name = stale;
  perform public.finish_post_photo_cleanup(array[stale], '{}');
  select count(*) into cnt from public.media_attachments where object_path = stale;
  if cnt <> 0 then raise exception 'FAIL cleanup record kept'; end if;
  perform set_config('role', 'authenticated', true);
  ok := false;
  begin perform public.claim_abandoned_post_photos(interval '1 second', 10); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL residents can run cleanup'; end if;
  passed := passed + 1;

  -- 7. Comments: retry after lost response, conflict, no duplicates, access still enforced.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  r := public.add_post_comment(cop, post_id, 'nice', null);
  r2 := public.add_post_comment(cop, post_id, 'nice', null);
  if r->>'outcome' <> 'created' or r2->>'outcome' <> 'existing' or r->>'comment_id' <> r2->>'comment_id' then raise exception 'FAIL comment retry % %', r, r2; end if;
  r2 := public.add_post_comment(cop, post_id, 'different', null);
  if r2->>'outcome' <> 'conflict' then raise exception 'FAIL comment conflict %', r2; end if;
  select count(*) into cnt from public.post_comments pc where pc.author_id = b;
  if cnt <> 1 then raise exception 'FAIL duplicate comment (%)', cnt; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.notifications where user_id = a and actor_id = b and type = 'reply';
  if cnt <> 1 then raise exception 'FAIL retry duplicated the notification (%)', cnt; end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  begin perform public.add_post_comment(gen_random_uuid(), post_id, 'x', null); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'forbidden' then raise exception 'FAIL unverified account commented: %', err; end if;
  begin perform public.publish_post(gen_random_uuid(), 'general', 'x', 'neighborhood', '{}'); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_verified' then raise exception 'FAIL unverified account published: %', err; end if;
  passed := passed + 1;

  -- 8. Clients can't change client_op_id or claim another post's op after the fact.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ok := false;
  begin update public.posts set client_op_id = gen_random_uuid() where id = post_id; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL client_op_id editable'; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks', passed;
end $t$;
