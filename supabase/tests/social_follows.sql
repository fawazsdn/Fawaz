-- Social profiles: follows, private accounts, follow requests, per-post
-- audiences, photo storage, comments moderation, blocks and account deletion.
-- Self-cleaning: the final RAISE aborts the transaction. Expected output:
-- "ALL_PASS ...". Run with: psql "$DATABASE_URL" -f supabase/tests/social_follows.sql
do $t$
declare
  -- a, b: verified in nb.  c: verified in nb2 (other neighborhood).  u: unverified.  s: staff.
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  u uuid := gen_random_uuid(); s uuid := gen_random_uuid();
  nb text := 'sa-district-10500227013'; nb2 text := 'sa-district-10500227005';
  st text; err text; cnt int; ok boolean; passed int := 0; j jsonb;
  p_nb uuid; p_pub uuid; p_fol uuid; cm uuid; cm2 uuid; photo text; legacy_photo text;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select x, 'authenticated', 'authenticated', 'social-test-' || x || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[a, b, c, u, s]) x;
  update public.profiles set first_name = 'Test', last_name = 'Person', profile_completed = true where id in (a, b, c, u, s);
  update public.profiles set first_name = 'Bader', last_name = 'Hidden', name_privacy = 'first_last_initial' where id = b;
  update public.profiles set app_role = 'moderator' where id = s;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (a, nb, 'verified', true, now()), (b, nb, 'verified', true, now()), (c, nb2, 'verified', true, now()),
         (s, nb, 'verified', true, now());
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active)
  values (u, nb, 'pending', true);
  perform set_config('role', 'authenticated', true);

  -- 1. Follows can't be forged, self-followed or written directly.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ok := false;
  begin insert into public.follows(follower_id, followee_id) values (a, b); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL direct follow insert allowed'; end if;
  begin perform public.follow_user(a); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'invalid:self' then raise exception 'FAIL self-follow: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  begin perform public.follow_user(a); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_verified' then raise exception 'FAIL unverified follow: %', err; end if;
  passed := passed + 1;

  -- 2. Public account: follow is immediate, idempotent, counted once, notified once.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  st := public.follow_user(a);
  if st <> 'following' then raise exception 'FAIL public follow state %', st; end if;
  st := public.follow_user(a);
  if st <> 'following' then raise exception 'FAIL repeat follow state %', st; end if;
  j := public.social_profile(a);
  if (j->>'followers_count')::int <> 1 or j->>'follow_state' <> 'following' then raise exception 'FAIL counts after follow %', j; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.notifications where user_id = a and actor_id = c and type = 'follow';
  if cnt <> 1 then raise exception 'FAIL follow notification count %', cnt; end if;
  perform set_config('role', 'authenticated', true);
  perform public.unfollow_user(a);
  perform public.follow_user(a);
  perform set_config('role', 'postgres', true);
  select count(*) into cnt from public.notifications where user_id = a and actor_id = c and type = 'follow';
  if cnt <> 1 then raise exception 'FAIL re-follow stacked notifications %', cnt; end if;
  perform set_config('role', 'authenticated', true);
  passed := passed + 1;

  -- 3. Private account (two accounts): request -> pending; content hidden until accepted.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.set_account_private(true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', b, nb, 'public post', 'public') returning id into p_pub;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', b, nb, 'followers post', 'followers') returning id into p_fol;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', b, nb, 'neighbors post', 'neighborhood') returning id into p_nb;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 0 then raise exception 'FAIL private account content visible to stranger (% rows)', cnt; end if;
  j := public.social_profile(b);
  if j is null or (j->>'can_view_content')::boolean or j->>'bio' is not null or j->>'last_name' <> 'H' then
    raise exception 'FAIL private profile card leaks %', j;
  end if;
  select count(*) into cnt from public.list_follows(b, 'followers');
  if cnt <> 0 then raise exception 'FAIL private follower list readable'; end if;
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 0 then raise exception 'FAIL private profile row readable cross-neighborhood'; end if;
  st := public.follow_user(b);
  if st <> 'requested' then raise exception 'FAIL private follow state %', st; end if;
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 0 then raise exception 'FAIL pending request reveals content'; end if;
  j := public.social_profile(b);
  if (j->>'followers_count')::int <> 0 then raise exception 'FAIL pending counted as follower'; end if;
  passed := passed + 1;

  -- 4. Withdraw, re-request, decline, re-request, accept.
  perform public.unfollow_user(b);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.list_follow_requests();
  if cnt <> 0 then raise exception 'FAIL withdrawn request still listed'; end if;
  select count(*) into cnt from public.notifications where type = 'follow_request' and actor_id = c;
  if cnt <> 0 then raise exception 'FAIL withdrawn request notification kept'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.follow_user(b);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.list_follow_requests() r where r.user_id = c;
  if cnt <> 1 then raise exception 'FAIL request not listed for recipient'; end if;
  select count(*) into cnt from public.profiles where id = c;
  if cnt <> 1 then raise exception 'FAIL recipient cannot see requester profile'; end if;
  perform public.respond_follow_request(c, false);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  if public.social_profile(b)->>'follow_state' <> 'none' then raise exception 'FAIL decline kept relationship'; end if;
  perform public.follow_user(b);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.respond_follow_request(c, true); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'not_found' then raise exception 'FAIL third party accepted a request: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.respond_follow_request(c, true);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 2 then raise exception 'FAIL accepted follower sees % posts (want public+followers)', cnt; end if;
  select count(*) into cnt from public.posts where id = p_nb;
  if cnt <> 0 then raise exception 'FAIL neighborhood-only post leaked to other neighborhood'; end if;
  select count(*) into cnt from public.notifications where user_id = c and type = 'follow_accepted';
  if cnt <> 1 then raise exception 'FAIL accepted notification missing'; end if;
  if (public.social_profile(b)->>'followers_count')::int <> 1 then raise exception 'FAIL follower count after accept'; end if;
  select count(*) into cnt from public.list_follows(b, 'followers');
  if cnt <> 1 then raise exception 'FAIL follower cannot read private follower list'; end if;
  passed := passed + 1;

  -- 5. Audiences for a same-neighborhood non-follower (a) of a private account.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where id in (p_pub, p_nb);
  if cnt <> 2 then raise exception 'FAIL neighbor misses public/neighborhood posts (%)', cnt; end if;
  select count(*) into cnt from public.posts where id = p_fol;
  if cnt <> 0 then raise exception 'FAIL followers-only post visible to non-follower neighbor'; end if;
  ok := false;
  begin insert into public.post_comments(post_id, author_id, body) values (p_fol, a, 'hi'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL comment on hidden post'; end if;
  ok := false;
  begin insert into public.post_reactions(post_id, user_id, type) values (p_fol, a, 'like'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL like on hidden post'; end if;
  ok := false;
  begin insert into public.saved_posts(post_id, user_id) values (p_fol, a); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL save of hidden post'; end if;
  passed := passed + 1;

  -- 6. Going public approves pending requests; public posts reach other neighborhoods.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.follow_user(b);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.remove_follower(c);
  perform public.set_account_private(false);
  if (public.social_profile(b)->>'followers_count')::int <> 1 then raise exception 'FAIL going public did not approve pending'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  if public.social_profile(b)->>'follow_state' <> 'none' then raise exception 'FAIL removed follower still following'; end if;
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 1 then raise exception 'FAIL stranger should see only the public post (%)', cnt; end if;
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 1 then raise exception 'FAIL public poster profile hidden'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where id = p_pub;
  if cnt <> 0 then raise exception 'FAIL unverified user reads public post'; end if;
  passed := passed + 1;

  -- 7. Photos: own-folder only, readable only through a visible post.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  photo := 'posts/' || b || '/p1.jpg';
  legacy_photo := nb || '/' || b || '/old.jpg';
  insert into storage.objects(bucket_id, name, owner_id) values ('community-media', photo, b::text);
  ok := false;
  begin insert into storage.objects(bucket_id, name, owner_id) values ('community-media', 'posts/' || a || '/x.jpg', b::text);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL upload into another user''s photo folder'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  ok := false;
  begin insert into storage.objects(bucket_id, name, owner_id) values ('community-media', 'posts/' || u || '/x.jpg', u::text);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL unverified upload'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where name = photo;
  if cnt <> 0 then raise exception 'FAIL unpublished photo readable'; end if;
  ok := false;
  begin insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, image_paths)
        values ('general', a, nb, 'steal', 'public', array[photo]);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL post referencing someone else''s photo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  ok := false;
  begin insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, image_paths)
        values ('general', b, nb, 'x', 'followers', array[legacy_photo]);
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL followers post using neighborhood-folder photo'; end if;
  ok := false;
  begin insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, image_paths)
        select 'general', b, nb, 'x', 'public', array_agg('posts/' || b || '/' || g || '.jpg') from generate_series(1, 11) g;
  exception when others then ok := true; end;
  if not ok then raise exception 'FAIL more than 10 photos accepted'; end if;
  ok := false;
  begin update public.posts set image_paths = array[photo] where id = p_fol; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL photo added on edit'; end if;
  ok := false;
  begin update public.posts set neighborhood_id = nb2 where id = p_fol; exception when others then ok := true; end;
  if not ok then raise exception 'FAIL post moved to another neighborhood'; end if;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, image_paths)
  values ('general', b, nb, 'photo post', 'followers', array[photo]) returning id into p_fol;
  update public.posts set text_ar = 'edited caption', image_paths = '{}' where id = p_pub;
  -- a follows b (accepted when b went public): sees the photo; c does not follow.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where name = photo;
  if cnt <> 1 then raise exception 'FAIL follower cannot read followers-post photo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into cnt from storage.objects where name = photo;
  if cnt <> 0 then raise exception 'FAIL non-follower reads followers-post photo'; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'community-media';
  if cnt <> 0 then raise exception 'FAIL photo listing leaks'; end if;
  passed := passed + 1;

  -- 8. Comments: post author moderates; others can't delete; staff can.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.post_comments(post_id, author_id, body) values (p_pub, a, 'nice') returning id into cm;
  insert into public.post_comments(post_id, author_id, body) values (p_pub, a, 'second') returning id into cm2;
  insert into public.post_reactions(post_id, user_id, type) values (p_pub, a, 'like');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin perform public.delete_post_comment(cm); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'forbidden' then raise exception 'FAIL stranger deleted comment: %', err; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.delete_post_comment(cm);
  select count(*) into cnt from public.post_comments where id = cm;
  if cnt <> 0 then raise exception 'FAIL post author could not remove comment'; end if;
  select count(*) into cnt from public.notifications where user_id = b and actor_id = a and type in ('reply', 'thanks');
  if cnt <> 3 then raise exception 'FAIL like/comment notifications (% rows)', cnt; end if;
  passed := passed + 1;

  -- 9. Blocks: relationship removed, content and profile hidden, no re-follow, no notifications.
  insert into public.user_blocks(blocker_id, blocked_id) values (b, a);
  if (public.social_profile(b)->>'followers_count')::int <> 0 then raise exception 'FAIL block kept follow'; end if;
  select count(*) into cnt from public.post_comments where id = cm2;
  if cnt <> 0 then raise exception 'FAIL blocked user''s comment visible to blocker'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 0 then raise exception 'FAIL blocked user sees blocker posts (%)', cnt; end if;
  if public.social_profile(b) is not null then raise exception 'FAIL blocked user gets profile card'; end if;
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 0 then raise exception 'FAIL blocked user reads blocker profile row'; end if;
  begin perform public.follow_user(b); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'blocked' then raise exception 'FAIL follow across block: %', err; end if;
  select count(*) into cnt from public.list_follows(b, 'followers');
  if cnt <> 0 then raise exception 'FAIL blocked user lists blocker followers'; end if;
  select count(*) into cnt from storage.objects where name = photo;
  if cnt <> 0 then raise exception 'FAIL blocked user reads blocker photo'; end if;
  ok := false;
  begin insert into public.post_reactions(post_id, user_id, type) values (p_nb, a, 'helpful'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL blocked user reacts to blocker post'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  if not (public.social_profile(a)->>'blocked_by_you')::boolean then raise exception 'FAIL blocker cannot see block state'; end if;
  begin perform public.follow_user(a); err := null; exception when others then err := sqlerrm; end;
  if err is distinct from 'blocked' then raise exception 'FAIL blocker follows blocked: %', err; end if;
  delete from public.user_blocks where blocker_id = b and blocked_id = a;
  passed := passed + 1;

  -- 10. Staff sees everything; lists search by visible name only (no hidden last-name match).
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where author_id = b;
  if cnt <> 4 then raise exception 'FAIL staff post visibility (%)', cnt; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.follow_user(b);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.follow_user(c);
  select count(*) into cnt from public.list_follows(c, 'following', 'bader');
  if cnt <> 1 then raise exception 'FAIL list search by first name'; end if;
  select count(*) into cnt from public.list_follows(c, 'following', 'hidden');
  if cnt <> 0 then raise exception 'FAIL search matched a hidden last name'; end if;
  passed := passed + 1;

  -- 11. Account deletion removes follows and the notifications the account caused.
  perform set_config('role', 'postgres', true);
  perform public.purge_account_data(c);
  select count(*) into cnt from public.follows where follower_id = c or followee_id = c;
  if cnt <> 0 then raise exception 'FAIL follows survive deletion'; end if;
  select count(*) into cnt from public.notifications where actor_id = c;
  if cnt <> 0 then raise exception 'FAIL notifications from deleted account survive'; end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.purge_account_data(a); err := null; exception when others then err := sqlerrm; end;
  if err is null then raise exception 'FAIL residents can call purge_account_data'; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks', passed;
end $t$;
