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
  local_two uuid;
  first_row jsonb;
  page_two text;
  bulk_expected text;
  bulk_walked text := '';
  bulk_cursor jsonb;
  bulk_page jsonb[];
  pages integer := 0;
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
  update public.profiles set profile_completed = true, first_name = 'Synthetic', last_name = 'Lastname',
    name_privacy = 'first_last_initial' where id in (viewer, author, unverified, nearby_author, far_author, private_nearby);
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (viewer, area, 'verified', true, now()), (author, area, 'verified', true, now()),
    (nearby_author, nearby, 'verified', true, now()), (far_author, far, 'verified', true, now()),
    (private_nearby, nearby, 'verified', true, now());
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', author, area, 'synthetic explore public', 'public') returning id into local_post;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience)
  values ('general', author, area, 'synthetic explore public two', 'public') returning id into local_two;
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
  select count(*) into matches from public.explore_social_feed('community', null, 'SYNTHETIC EXPLORE') item
    where item->>'author_id' = author::text and item->>'id' = local_post::text
      and not (item ?| array['location_label', 'approx_lat', 'approx_lng']);
  if matches <> 1 then raise exception 'Community should include the local public post without location metadata'; end if;
  if (select string_agg(item->>'id', ',' order by position)
      from public.explore_social_feed('community', null, 'synthetic explore') with ordinality as feed(item,position)
      where position > 2) is distinct from nearby_post::text
    or (select count(*) from public.explore_social_feed('community', null, 'synthetic explore') with ordinality as feed(item,position)
      where position <= 2 and item->>'id' in (local_post::text, local_two::text)) <> 2 then
    raise exception 'Community did not rank local before nearby public, or exposed a nearby neighborhood post';
  end if;

  -- Keyset pagination: take the first row's cursor, then (after the snapshot) publish a new
  -- local post and like the second row. With an offset the new post would shift page two, and
  -- the like could lift the second row above the cursor; both must leave page two unchanged.
  select item into first_row from public.explore_social_feed('community', null, 'synthetic explore') item limit 1;
  page_two := (select string_agg(item->>'id', ',') from public.explore_social_feed('community', first_row->'feed_cursor', 'synthetic explore') item);
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, created_at)
  values ('general', author, area, 'synthetic explore late', 'public', now() + interval '1 second');
  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  insert into public.post_reactions(post_id, user_id, type, created_at)
  values ((select case when first_row->>'id' = local_post::text then local_two else local_post end), viewer, 'like', now() + interval '1 second');
  if (select string_agg(item->>'id', ',') from public.explore_social_feed('community', first_row->'feed_cursor', 'synthetic explore') item)
     is distinct from page_two or page_two not like '%' || nearby_post || '%' or page_two like '%' || (first_row->>'id') || '%' then
    raise exception 'Keyset pagination skipped, repeated or shifted posts: %', page_two;
  end if;

  -- A multi-page walk over 20 posts while new posts and likes arrive between pages returns
  -- exactly the original 20, in the snapshot order, with no gaps or repeats.
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, created_at)
  select 'general', author, area, 'synthetic bulk ' || i, 'public', now() - make_interval(mins => i) from generate_series(1, 20) i;
  perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
  select string_agg(id::text, ',' order by created_at desc, id desc) into bulk_expected from public.posts where text_ar like 'synthetic bulk %';
  loop
    select array_agg(item) into bulk_page from public.explore_social_feed('community', bulk_cursor, 'synthetic bulk') item;
    exit when bulk_page is null;
    pages := pages + 1;
    bulk_walked := bulk_walked || (select string_agg(x->>'id', ',') from unnest(bulk_page) x) || ',';
    bulk_cursor := bulk_page[array_length(bulk_page, 1)]->'feed_cursor';
    -- between pages: a brand-new post and a like on a not-yet-shown post
    perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
    insert into public.posts(type, author_id, neighborhood_id, text_ar, audience, created_at)
    values ('general', author, area, 'synthetic bulk late ' || pages, 'public', now() + interval '1 second');
    perform set_config('request.jwt.claims', json_build_object('sub', viewer, 'role', 'authenticated')::text, true);
    insert into public.post_reactions(post_id, user_id, type, created_at)
    select id, viewer, 'like', now() + interval '1 second' from public.posts
    where text_ar = 'synthetic bulk 20' on conflict do nothing;
    exit when array_length(bulk_page, 1) < 16 or pages > 5;
  end loop;
  if pages <> 2 or rtrim(bulk_walked, ',') is distinct from bulk_expected then
    raise exception 'Multi-page walk skipped or repeated posts (pages=%)', pages;
  end if;
  passed := passed + 1;

  -- Author identity: masked by the author's name setting, nothing beyond the display fields.
  if (first_row->'author'->>'last_name') is distinct from 'L' or (first_row->'author'->>'first_name') is distinct from 'Synthetic'
    or exists (select from jsonb_object_keys(first_row->'author') k
               where k not in ('id', 'first_name', 'last_name', 'name_privacy', 'avatar_path'))
    or (first_row->'area'->>'id') is distinct from area then
    raise exception 'Author fields not masked or too broad: %', first_row->'author';
  end if;
  passed := passed + 2;
  if exists (select from public.explore_social_feed('community', null, 'synthetic explore') item
    where item->>'id' in (follower_post::text, deleted_post::text)) then
    raise exception 'Community exposed followers-only or deleted content';
  end if;
  if exists (select from public.explore_social_feed('community', null, 'synthetic explore') item
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
  if has_function_privilege('anon', 'public.explore_social_feed(text,jsonb,text)', 'execute') then
    raise exception 'Anonymous feed execute privilege';
  end if;
  passed := passed + 1;
  raise exception 'ALL_PASS % checks (rolled back): local before nearby, keyset pagination, 20-post multi-page walk, masked author, nearby audience, far, nearby private, no profile exposure, pagination, redacted location, search, deleted, pending, accepted, private, block, notification RLS (block, deleted post), unverified, anonymous', passed;
end;
$test$;
