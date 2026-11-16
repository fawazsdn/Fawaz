-- Run after the Explore migration in a synthetic Supabase database.
-- Self-cleaning: the final RAISE aborts the transaction. Expected output: "ALL_PASS ...".
do $test$
declare
  viewer uuid := gen_random_uuid();
  author uuid := gen_random_uuid();
  unverified uuid := gen_random_uuid();
  area text;
  nearby text;
  nearby_author uuid := gen_random_uuid();
  nearby_post uuid;
  far text;
  far_author uuid := gen_random_uuid();
  far_post uuid;
  private_nearby uuid := gen_random_uuid();
  private_nearby_post uuid;
  passed integer := 0;
  local_post uuid;
  follower_post uuid;
  deleted_post uuid;
  matches integer;
begin
  -- A synthetic home area with a center (nearby ranking needs coordinates; neighborhoods
  -- without a center only get local posts), copied from any existing neighborhood's city.
  area := 'explore-fixture-' || gen_random_uuid();
  insert into public.neighborhoods (id, city_id, region_id, name_ar, name_en, center_lat, center_lng, source, source_id)
  select area, city_id, region_id, 'حي الاختبار', 'Synthetic home neighborhood', 24.7, 46.7, 'synthetic', area
  from public.neighborhoods order by id limit 1;
  nearby := 'explore-fixture-' || gen_random_uuid();
  insert into public.neighborhoods (id, city_id, region_id, name_ar, name_en, center_lat, center_lng, source, source_id)
  select nearby, city_id, region_id, 'حي تجريبي', 'Synthetic nearby neighborhood',
    center_lat + 0.01, center_lng, 'synthetic', nearby
  from public.neighborhoods where id = area;
  far := 'explore-fixture-' || gen_random_uuid();
  insert into public.neighborhoods (id, city_id, region_id, name_ar, name_en, center_lat, center_lng, source, source_id)
  select far, city_id, region_id, 'حي بعيد', 'Synthetic far neighborhood',
    center_lat + 1.0, center_lng, 'synthetic', far
  from public.neighborhoods where id = area;
  insert into auth.users(id, aud, role, email, instance_id)
  select id, 'authenticated', 'authenticated', 'explore-' || id || '@example.invalid', '00000000-0000-0000-0000-000000000000'
  from unnest(array[viewer, author, unverified, nearby_author, far_author, private_nearby]) id;
  update public.profiles set profile_completed = true, first_name = 'Synthetic' where id in (viewer, author, unverified, nearby_author, far_author, private_nearby);
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (viewer, area, 'verified', true, now()), (author, area, 'verified', true, now()),
    (nearby_author, nearby, 'verified', true, now()), (far_author, far, 'verified', true, now()),
    (private_nearby, nearby, 'verified', true, now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', author, area, 'synthetic explore public', 'public') returning id into local_post;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', author, area, 'synthetic explore followers', 'followers') returning id into follower_post;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', author, area, 'synthetic explore deleted', 'public') returning id into deleted_post;
  perform public.delete_post(deleted_post);
  perform set_config('request.jwt.claims', json_build_object('sub', nearby_author, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', nearby_author, nearby, 'synthetic explore nearby', 'public') returning id into nearby_post;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', nearby_author, nearby, 'synthetic explore nearby neighbors only', 'neighborhood');
  perform set_config('request.jwt.claims', json_build_object('sub', far_author, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', far_author, far, 'synthetic explore far', 'public') returning id into far_post;
  perform set_config('request.jwt.claims', json_build_object('sub', private_nearby, 'role', 'authenticated')::text, true);
  perform public.set_account_private(true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', private_nearby, nearby, 'synthetic explore nearby private author', 'public') returning id into private_nearby_post;

  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  select count(*) into matches from public.explore_social_feed('community', 0, 'SYNTHETIC EXPLORE') item
    where item->>'author_id' = author::text and item->>'id' = local_post::text
      and not (item ?| array['location_label', 'approx_lat', 'approx_lng']);
  if matches <> 1 then raise exception 'Community should include the local public post without location metadata'; end if;
  if (select string_agg(item->>'id', ',' order by position)
      from public.explore_social_feed('community',0,'synthetic explore') with ordinality as feed(item,position))
    is distinct from local_post || ',' || nearby_post then
    raise exception 'Community did not rank local before nearby public, or exposed a nearby neighborhood post';
  end if;
  if (select item->>'id' from public.explore_social_feed('community',1,'synthetic explore') item limit 1)
     is distinct from nearby_post::text then
    raise exception 'Pagination did not preserve ranking';
  end if;
  if exists (select from public.explore_social_feed('community', 0, 'synthetic explore') item
    where item->>'id' in (follower_post::text, deleted_post::text)) then
    raise exception 'Community exposed followers-only or deleted content';
  end if;
  if exists (select from public.explore_social_feed('community', 0, 'synthetic explore') item
    where item->>'id' in (far_post::text, private_nearby_post::text)) then
    raise exception 'Community exposed a far neighborhood or a nearby private account';
  end if;
  if exists (select from public.profiles where id = private_nearby) then
    raise exception 'A private account outside the neighborhood became visible';
  end if;
  passed := passed + 6;
  if exists (select from public.explore_social_feed('friends') item where item->>'author_id' = author::text) then
    raise exception 'Friends exposed an unfollowed author';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  perform public.set_account_private(true);
  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  perform public.follow_user(author);
  if exists (select from public.explore_social_feed('friends') item where item->>'author_id' = author::text) then
    raise exception 'Friends exposed a pending follow';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  perform public.respond_follow_request(viewer, true);
  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  if exists (select from public.explore_social_feed('community') item where item->>'author_id' = author::text) then
    raise exception 'Community exposed a private account';
  end if;
  if not exists (select from public.explore_social_feed('friends') item where item->>'id' = follower_post::text) then
    raise exception 'Friends hid the approved follower post';
  end if;

  if not exists (select from public.explore_social_feed('friends') item where item->>'id' = follower_post::text) then
    raise exception 'Friends lost the follower post';
  end if;
  passed := passed + 4;

  -- A notification about a post disappears once the post is deleted.
  insert into public.post_comments(post_id, author_id, body) values (nearby_post, viewer, 'Synthetic nearby comment');
  perform set_config('request.jwt.claims', json_build_object('sub', nearby_author, 'role', 'authenticated')::text, true);
  if not exists (select from public.notifications where user_id = nearby_author and deep_link = '/post/' || nearby_post) then
    raise exception 'Expected a notification for the nearby comment';
  end if;
  perform public.delete_post(nearby_post);
  if exists (select from public.notifications where user_id = nearby_author and deep_link = '/post/' || nearby_post) then
    raise exception 'Notification RLS exposed a deleted post';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  passed := passed + 1;

  insert into public.post_comments(post_id, author_id, body) values (follower_post, viewer, 'Synthetic comment');
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  if not exists (select from public.notifications where user_id = author and actor_id = viewer and deep_link = '/post/' || follower_post) then
    raise exception 'Expected a visible notification before block';
  end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (author, viewer);
  if exists (select from public.notifications where user_id = author and actor_id = viewer and deep_link = '/post/' || follower_post) then
    raise exception 'Notification RLS exposed a blocked actor';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  if exists (select from public.explore_social_feed('friends') item where item->>'author_id' = author::text) then
    raise exception 'Friends exposed a blocked author';
  end if;
  passed := passed + 2;
  perform set_config('request.jwt.claims', json_build_object('sub', unverified, 'role', 'authenticated')::text, true);
  if exists (select from public.explore_social_feed('community')) or exists (select from public.explore_social_feed('friends')) then
    raise exception 'Feed exposed content to an unverified viewer';
  end if;
  if has_function_privilege('anon', 'public.explore_social_feed(text,integer,text)', 'execute') then
    raise exception 'Anonymous feed execute privilege';
  end if;
  passed := passed + 1;
  raise exception 'ALL_PASS % checks (rolled back): local before nearby, nearby audience, far, nearby private, no profile exposure, pagination, redacted location, search, deleted, pending, accepted, private, block, notification RLS (block, deleted post), unverified, anonymous', passed;
end;
$test$;
