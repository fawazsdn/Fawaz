-- Private accounts and audiences (20261115100000): followers-only activity never
-- makes an account visible to the neighborhood; neighborhood-wide activity does,
-- without exposing followers-only content; a block hides everything.
-- Synthetic accounts only. Self-cleaning: the final RAISE aborts the transaction.
-- Expected output: "ALL_PASS ...".
do $t$
declare
  -- a: verified neighbor (viewer).  b: private account.  f: b's accepted follower.  All in nb.
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); f uuid := gen_random_uuid();
  nb text := coalesce(nullif(current_setting('haratna.test_nb', true), ''), 'sa-district-10500227013');
  cnt int; ok boolean; j jsonb; passed int := 0; p_fol uuid; p_nb uuid;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select x, 'authenticated', 'authenticated', 'audience-test-' || x || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[a, b, f]) x;
  update public.profiles set first_name = 'Test', last_name = 'Person', profile_completed = true where id in (a, b, f);
  update public.profiles set avatar_path = b || '/photo.jpg' where id = b;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (a, nb, 'verified', true, now()), (b, nb, 'verified', true, now()), (f, nb, 'verified', true, now());
  perform set_config('role', 'authenticated', true);

  -- b goes private and accepts f.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.set_account_private(true);
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.follow_user(b);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.respond_follow_request(f, true);

  -- 1. A followers-only post does not make b visible to the neighborhood.
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', b, nb, 'followers only', 'followers') returning id into p_fol;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 0 then raise exception 'FAIL followers-only post exposed the private profile row'; end if;
  j := public.social_profile(b);
  if j is not null and (j ? 'avatar_path') and j->>'avatar_path' is not null then
    raise exception 'FAIL followers-only post exposed the private photo path: %', j;
  end if;
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 0 then raise exception 'FAIL neighbor sees a followers-only post'; end if;
  perform set_config('role', 'postgres', true);
  if private.can_view_profile_photo(b) then raise exception 'FAIL followers-only post granted the private photo'; end if;
  if private.profile_visible(b) then raise exception 'FAIL followers-only post made the profile visible'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 2. Comments on a followers-only post don't count either (b's own and on others').
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.post_comments(post_id, author_id, body) values (p_fol, b, 'my own comment');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'postgres', true);
  if private.profile_visible(b) or private.can_view_profile_photo(b) then
    raise exception 'FAIL a comment on a followers-only post exposed the private account';
  end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 3. The accepted follower still sees the profile, photo and followers-only post.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where id = p_fol;
  if cnt <> 1 then raise exception 'FAIL accepted follower lost the followers-only post'; end if;
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 1 then raise exception 'FAIL accepted follower lost the profile'; end if;
  perform set_config('role', 'postgres', true);
  if not private.can_view_profile_photo(b) then raise exception 'FAIL accepted follower lost the photo'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 4. A neighborhood-wide post makes b visible to neighbors - but never the followers-only content.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', b, nb, 'for the neighborhood', 'neighborhood') returning id into p_nb;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 1 then raise exception 'FAIL neighborhood post did not make the profile visible'; end if;
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 1 then raise exception 'FAIL neighbor sees % of b''s posts (only the neighborhood one is allowed)', cnt; end if;
  select count(*) into cnt from public.posts where id = p_fol;
  if cnt <> 0 then raise exception 'FAIL neighborhood visibility exposed the followers-only post'; end if;
  select count(*) into cnt from public.post_comments where post_id = p_fol;
  if cnt <> 0 then raise exception 'FAIL neighbor sees comments on the followers-only post'; end if;
  perform set_config('role', 'postgres', true);
  if not private.can_view_profile_photo(b) then raise exception 'FAIL neighborhood post did not grant the photo'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 5. Once that post is deleted, b is private to the neighborhood again.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.delete_post(p_nb);  -- the app's delete path
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'postgres', true);
  if private.profile_visible(b) or private.can_view_profile_photo(b) then
    raise exception 'FAIL a deleted neighborhood post still exposes the private account';
  end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 6. A block hides everything, whatever b posts.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', b, nb, 'again', 'neighborhood');
  insert into public.user_blocks(blocker_id, blocked_id) values (b, a);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 0 then raise exception 'FAIL blocked viewer sees the profile'; end if;
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 0 then raise exception 'FAIL blocked viewer sees posts'; end if;
  perform set_config('role', 'postgres', true);
  if private.can_view_profile_photo(b) then raise exception 'FAIL blocked viewer may sign the photo'; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
