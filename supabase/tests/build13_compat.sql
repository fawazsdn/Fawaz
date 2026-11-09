-- Build 13 compatibility after 20261109120000 + 20261109130000.
-- Replays the exact database operations of the build 13 app (commit 0468b75:
-- src/backend/actions.ts, sync.ts, media.ts) for two residents of one
-- neighborhood, while a third account uses the new build. Self-cleaning.
-- Expected output: "ALL_PASS ...". Run with: psql "$DATABASE_URL" -f supabase/tests/build13_compat.sql
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); n uuid := gen_random_uuid();
  nb text := 'sa-district-10500227013';
  cnt int; ok boolean; passed int := 0; p1 uuid; p2 uuid; p_pub uuid; p_fol uuid; cm uuid; notif uuid;
  avatar text; photo text;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  select x, 'authenticated', 'authenticated', 'b13-' || x || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[a, b, n]) x;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (a, nb, 'verified', true, now()), (b, nb, 'verified', true, now()), (n, nb, 'verified', true, now());
  perform set_config('role', 'authenticated', true);

  -- 1. saveProfile: upload to the public avatars bucket, record it, update the profile row.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  avatar := a || '/m1a2b3-abcd.jpg';
  insert into storage.objects(bucket_id, name, owner_id) values ('avatars', avatar, a::text);
  insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes)
  values (a, null, 'avatars', avatar, 'image/jpeg', 2048);
  update public.profiles set first_name = 'Amal', last_name = 'K', name_privacy = 'first_last_initial', bio = 'hi',
    profile_completed = true, locale = 'ar', avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/' || avatar
  where id = a;
  select count(*) into cnt from public.profiles where id = a and avatar_url like '%' || avatar;
  if cnt <> 1 then raise exception 'FAIL build 13 profile photo update'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  update public.profiles set first_name = 'Badr', profile_completed = true where id = b;
  passed := passed + 1;

  -- 2. createPost: photo into <neighborhood>/<uid>/, record, insert with 'neighborhood' and 'city' audiences.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  photo := nb || '/' || a || '/m1-xyz.jpg';
  insert into storage.objects(bucket_id, name, owner_id) values ('community-media', photo, a::text);
  insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes)
  values (a, nb, 'community-media', photo, 'image/jpeg', 4096);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, image_paths, audience, approx_lat, approx_lng, location_label)
  values ('general', a, nb, 'مرحبا', array[photo], 'neighborhood', 24.713, 46.675, null) returning id into p1;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, image_paths, audience)
  values ('announcement', a, nb, 'city post', '{}', 'city') returning id into p2;
  passed := passed + 1;

  -- 3. A neighbor on build 13 loads the feed (posts by neighborhood + reactions + comment counts) and signs the photo.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where neighborhood_id = nb and id in (p1, p2);
  if cnt <> 2 then raise exception 'FAIL build 13 feed misses neighborhood posts (%)', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'community-media' and name = photo;
  if cnt <> 1 then raise exception 'FAIL build 13 neighbor cannot sign a neighborhood photo'; end if;
  select count(*) into cnt from public.profiles where id = a;
  if cnt <> 1 then raise exception 'FAIL build 13 neighbor cannot load the author profile'; end if;
  passed := passed + 1;

  -- 4. Reactions, saves, comments (add, edit, like, soft delete) exactly as build 13 writes them.
  insert into public.post_reactions(post_id, user_id, type) values (p1, b, 'like');
  delete from public.post_reactions where post_id = p1 and user_id = b;
  insert into public.post_reactions(post_id, user_id, type) values (p2, b, 'helpful');
  insert into public.saved_posts(post_id, user_id) values (p1, b);
  delete from public.saved_posts where post_id = p1 and user_id = b;
  insert into public.post_comments(post_id, author_id, body, parent_id) values (p1, b, 'جميل', null) returning id into cm;
  insert into public.post_comments(post_id, author_id, body, parent_id) values (p1, b, 'reply', cm);
  update public.post_comments set body = 'جميل جداً', edited_at = now() where id = cm;
  insert into public.comment_reactions(comment_id, user_id, type) values (cm, b, 'like');
  delete from public.comment_reactions where comment_id = cm and user_id = b;
  -- Build 13 soft-deletes with a direct UPDATE. That is refused by RLS on
  -- today's production schema as well (pre-existing, unchanged by these
  -- migrations); the new build uses delete_post_comment / delete_post.
  ok := false;
  begin update public.post_comments set deleted_at = now() where id = cm; exception when others then ok := sqlerrm like 'new row violates row-level security%'; end;
  if not ok then raise exception 'FAIL build 13 comment soft delete behaves differently from production'; end if;
  perform public.delete_post_comment(cm);
  select count(*) into cnt from public.post_comments where post_id = p1;
  if cnt <> 1 then raise exception 'FAIL comment flow (% visible)', cnt; end if;
  passed := passed + 1;

  -- 5. Notifications (old types, opened and marked read) still work; a block and report too.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select id into notif from public.notifications where user_id = a and type in ('reply', 'thanks') limit 1;
  if notif is null then raise exception 'FAIL like/comment notifications missing for build 13'; end if;
  update public.notifications set read_at = now() where id = notif;
  update public.notifications set read_at = now() where user_id = a and read_at is null;
  insert into public.reports(reporter_id, target_type, target_id, reason) values (a, 'comment', cm, 'spam');
  insert into public.user_mutes(muter_id, muted_id) values (a, b);
  delete from public.user_mutes where muter_id = a and muted_id = b;
  passed := passed + 1;

  -- 6. Content from someone on the new build: build 13 sees public posts of its neighborhood
  --    (and their photos), never followers-only posts it isn't allowed to see.
  perform set_config('request.jwt.claims', json_build_object('sub', n, 'role', 'authenticated')::text, true);
  insert into storage.objects(bucket_id, name, owner_id) values ('community-media', 'posts/' || n || '/1.jpg', n::text);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, image_paths, audience)
  values ('general', n, nb, 'public', array['posts/' || n || '/1.jpg'], 'public') returning id into p_pub;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', n, nb, 'followers', 'followers') returning id into p_fol;
  perform public.follow_user(a);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.posts where neighborhood_id = nb and id = p_pub;
  if cnt <> 1 then raise exception 'FAIL build 13 misses a public post from its neighborhood'; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'community-media' and name = 'posts/' || n || '/1.jpg';
  if cnt <> 1 then raise exception 'FAIL build 13 cannot sign a public post photo'; end if;
  select count(*) into cnt from public.posts where id = p_fol;
  if cnt <> 0 then raise exception 'FAIL followers-only post leaks to build 13 non-follower'; end if;
  -- New notification types reach build 13 users as plain title/body rows with a valid deep link.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into cnt from public.notifications where user_id = a and type = 'follow' and deep_link = '/profile/' || n
    and title_ar <> '' and body_ar <> '';
  if cnt <> 1 then raise exception 'FAIL follow notification not renderable by build 13'; end if;
  passed := passed + 1;

  -- 7. Post deletion: build 13's direct UPDATE fails exactly as today; the new
  --    delete_post works for the author and staff only. Blocking still works.
  ok := false;
  begin update public.posts set deleted_at = now() where id = p2; exception when others then ok := sqlerrm like 'new row violates row-level security%'; end;
  if not ok then raise exception 'FAIL build 13 post soft delete behaves differently from production'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.delete_post(p2); ok := false; exception when others then ok := sqlerrm = 'forbidden'; end;
  if not ok then raise exception 'FAIL someone else deleted a post'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.delete_post(p2);
  select count(*) into cnt from public.posts where id = p2;
  if cnt <> 0 then raise exception 'FAIL author could not delete own post'; end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (a, b);
  delete from public.user_blocks where blocker_id = a and blocked_id = b;
  passed := passed + 1;

  -- 8. Build 13 cannot use the new audiences by mistake beyond what it already sends,
  --    and still cannot write audiences that don't exist.
  ok := false;
  begin insert into public.posts(type, author_id, neighborhood_id, text_ar, audience) values ('general', a, nb, 'x', 'everyone'); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL unknown audience accepted'; end if;
  passed := passed + 1;

  -- 9. Legacy deletion path (delete-account v5 -> purge_account_data as the service role) still works.
  perform set_config('role', 'postgres', true);
  perform public.purge_account_data(b);
  select count(*) into cnt from public.profiles where id = b;
  if cnt <> 0 then raise exception 'FAIL legacy purge'; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks', passed;
end $t$;
