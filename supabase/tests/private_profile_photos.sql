-- Private profile photos and RLS hardening (20261109130000). Two accounts and
-- a stranger exercise public/private photos, follows, requests, blocks and
-- the folder rules. Self-cleaning: the final RAISE aborts the transaction.
-- Expected output: "ALL_PASS ...". Run with: psql "$DATABASE_URL" -f supabase/tests/private_profile_photos.sql
do $t$
declare
  -- a, b verified in nb; c verified in nb2; u unverified; s staff.
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  u uuid := gen_random_uuid(); s uuid := gen_random_uuid();
  nb text := 'sa-district-10500227013'; nb2 text := 'sa-district-10500227005';
  cnt int; ok boolean; err text; passed int := 0; j jsonb; photo_b text; photo_c text; p uuid; cm uuid;
  legacy text := 'https://example.supabase.co/storage/v1/object/public/avatars/';
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select x, 'authenticated', 'authenticated', 'photo-test-' || x || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[a, b, c, u, s]) x;
  update public.profiles set first_name = 'Test', last_name = 'Person', profile_completed = true where id in (a, b, c, u, s);
  update public.profiles set app_role = 'moderator' where id = s;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (a, nb, 'verified', true, now()), (b, nb, 'verified', true, now()), (c, nb2, 'verified', true, now()), (s, nb, 'verified', true, now());
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active) values (u, nb, 'pending', true);
  photo_b := b || '/me.jpg';
  photo_c := c || '/me.jpg';
  perform set_config('role', 'authenticated', true);

  -- 1. Uploads only into your own folder; avatar_path must point there too.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into storage.objects(bucket_id, name, owner_id) values ('profile-photos', photo_b, b::text);
  ok := false;
  begin insert into storage.objects(bucket_id, name, owner_id) values ('profile-photos', a || '/x.jpg', b::text); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL upload into another account''s photo folder'; end if;
  ok := false;
  begin update public.profiles set avatar_path = a || '/x.jpg' where id = b; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL avatar_path pointing at someone else''s folder'; end if;
  ok := false;
  begin update public.profiles set avatar_path = b || '/../' || a || '/x.jpg' where id = b; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL avatar_path traversal accepted'; end if;
  update public.profiles set avatar_path = photo_b, avatar_url = legacy || b || '/old.jpg' where id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  insert into storage.objects(bucket_id, name, owner_id) values ('profile-photos', photo_c, c::text);
  update public.profiles set avatar_path = photo_c where id = c;
  passed := passed + 1;

  -- 2. Public account: any verified resident may see the photo; unverified may not.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 1 then raise exception 'FAIL verified resident cannot see a public account''s photo'; end if;
  j := public.social_profile(b);
  if j->>'avatar_path' is distinct from photo_b then raise exception 'FAIL card hides public photo %', j; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 0 then raise exception 'FAIL unverified account reads profile photo'; end if;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  ok := false;
  begin select count(*) into cnt from storage.objects where bucket_id = 'profile-photos'; exception when others then ok := true; cnt := 0; end;
  if cnt <> 0 then raise exception 'FAIL anonymous read of profile photos'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 3. Going private: strangers lose the photo (storage, card and legacy URL); the owner keeps it.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.set_account_private(true);
  select count(*) into cnt from public.profiles where id = b and avatar_url is null;
  if cnt <> 1 then raise exception 'FAIL legacy public URL kept on a private account'; end if;
  -- The link is archived (the public file is kept for the approved cleanup / a rollback), and clients can't read the archive.
  ok := false;
  begin select count(*) into cnt from private.avatar_legacy_urls; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL clients can read the legacy photo archive'; end if;
  ok := false;
  begin perform public.legacy_avatar_inventory(); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL residents can call the operator photo inventory'; end if;
  ok := false;
  begin perform public.mark_legacy_avatar_removed(b, 'x'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL residents can mark photo files removed'; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from private.avatar_legacy_urls where user_id = b and reason = 'went_private' and url = legacy || b || '/old.jpg' and file_removed_at is null;
  if cnt <> 1 then raise exception 'FAIL went-private link not archived'; end if;
  perform set_config('role', 'authenticated', true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 1 then raise exception 'FAIL owner cannot see own photo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 0 then raise exception 'FAIL stranger reads private account photo'; end if;
  j := public.social_profile(b);
  if j->>'avatar_path' is not null or j->>'avatar_url' is not null then raise exception 'FAIL card leaks private photo %', j; end if;
  passed := passed + 1;

  -- 4. A pending follow request grants no photo access, in either direction.
  --    c (public) asks to follow private b: c can't see b's photo; b sees c's
  --    only because c's account is public.
  perform public.follow_user(b);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 0 then raise exception 'FAIL pending request reveals private photo'; end if;
  if public.social_profile(b)->>'avatar_path' is not null then raise exception 'FAIL pending request: card shows private photo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.list_follow_requests() r where r.user_id = c and r.avatar_path = photo_c;
  if cnt <> 1 then raise exception 'FAIL recipient cannot see a public requester photo'; end if;
  --    Now the requester is private too: the recipient must not see its photo.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.set_account_private(true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.list_follow_requests() r where r.user_id = c and r.avatar_path is null and r.avatar_url is null;
  if cnt <> 1 then raise exception 'FAIL private requester photo shown to the recipient'; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_c;
  if cnt <> 0 then raise exception 'FAIL private requester photo readable by the recipient'; end if;
  if public.social_profile(c)->>'avatar_path' is not null then raise exception 'FAIL private requester card shows photo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.set_account_private(false);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  -- 5. Accepted follower sees it; removed follower loses it again.
  perform public.respond_follow_request(c, true);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 1 then raise exception 'FAIL accepted follower cannot see private photo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.remove_follower(c);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 0 then raise exception 'FAIL removed follower still sees private photo'; end if;
  passed := passed + 2;

  -- 6. Same-neighborhood resident who already sees the full profile under the
  --    existing neighborhood rules (b has posts) keeps seeing the photo.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', b, nb, 'hi', 'neighborhood') returning id into p;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 1 then raise exception 'FAIL neighbor with profile access loses photo'; end if;
  -- 7. Blocking hides the photo both ways; staff always can see it.
  insert into storage.objects(bucket_id, name, owner_id) values ('profile-photos', a || '/me.jpg', a::text);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = a || '/me.jpg';
  if cnt <> 1 then raise exception 'FAIL neighbor cannot see public account photo before block'; end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (b, a);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = a || '/me.jpg';
  if cnt <> 0 then raise exception 'FAIL blocker reads blocked account photo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 0 then raise exception 'FAIL blocked account reads blocker photo'; end if;
  if public.social_profile(b) is not null then raise exception 'FAIL blocked account gets card'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  if cnt <> 1 then raise exception 'FAIL staff cannot see profile photo'; end if;
  passed := passed + 1;

  -- 8. media_attachments are private to their owner; a neighbor can't list them.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes)
  values (b, nb, 'profile-photos', photo_b, 'image/jpeg', 1000);
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.media_attachments where owner_id = b;
  if cnt <> 1 then raise exception 'FAIL staff cannot read attachments'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  delete from public.user_blocks where blocker_id = b and blocked_id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.media_attachments where owner_id = b;
  if cnt <> 0 then raise exception 'FAIL neighbor lists someone else''s media paths'; end if;
  passed := passed + 1;

  -- 9. Comments can't be moved to another post or re-attributed by editing.
  insert into public.post_comments(post_id, author_id, body) values (p, a, 'nice') returning id into cm;
  ok := false;
  begin update public.post_comments set author_id = b where id = cm; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL comment re-attributed'; end if;
  ok := false;
  begin update public.post_comments set parent_id = cm, post_id = p where id = cm; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL comment re-parented'; end if;
  update public.post_comments set body = 'nicer', edited_at = now() where id = cm;
  passed := passed + 1;

  -- 10. Privilege fields stay protected; is_private and avatar_path are the only new self-editable fields.
  ok := false;
  begin update public.profiles set app_role = 'admin' where id = a; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL self-promotion to admin'; end if;
  update public.profiles set is_private = false, avatar_path = null where id = b;  -- RLS: touches 0 rows
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.profiles where id = b and is_private and avatar_path = photo_b;
  if cnt <> 1 then raise exception 'FAIL another account changed b''s privacy or photo'; end if;
  passed := passed + 1;

  -- 11. Replacing or removing a public photo archives the old link; nothing is deleted.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.profiles set avatar_url = legacy || a || '/1.jpg' where id = a;
  update public.profiles set avatar_url = legacy || a || '/2.jpg' where id = a;
  update public.profiles set avatar_url = null, avatar_path = null where id = a;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from private.avatar_legacy_urls where user_id = a and
    ((reason = 'replaced' and url like '%/1.jpg') or (reason = 'removed' and url like '%/2.jpg'));
  if cnt <> 2 then raise exception 'FAIL replaced/removed links not archived (%)', cnt; end if;
  passed := passed + 1;

  -- 12. Account deletion removes the account's attachments rows and social links.
  perform public.purge_account_data(b);
  select count(*) into cnt from public.media_attachments where owner_id = b;
  if cnt <> 0 then raise exception 'FAIL attachment rows survive deletion'; end if;
  select count(*) into cnt from public.follows where follower_id = b or followee_id = b;
  if cnt <> 0 then raise exception 'FAIL follows survive deletion'; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks', passed;
end $t$;
