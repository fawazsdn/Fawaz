-- Deleted-post photo retention (20261115110000): a 24-hour recovery grace, then cleanup.
-- Synthetic accounts and files only. Self-cleaning: the final RAISE aborts the transaction.
-- Expected output: "ALL_PASS ...".
do $t$
declare
  a uuid := gen_random_uuid();
  nb text := coalesce(nullif(current_setting('haratna.test_nb', true), ''), 'sa-district-10500227013');
  p1 text; p2 text; p3 text; p4 text; post1 uuid; post2 uuid; post3 uuid; post4a uuid; post4b uuid;
  r jsonb; cnt int; claimed text[]; err text; passed int := 0;
begin
  insert into auth.users(id, aud, role, email, instance_id)
  values (a, 'authenticated', 'authenticated', 'ret-' || a || '@example.invalid', '00000000-0000-0000-0000-000000000000');
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
  values (a, nb, 'verified', true, now());
  p1 := 'posts/' || a || '/1.jpg'; p2 := 'posts/' || a || '/2.jpg'; p3 := 'posts/' || a || '/3.jpg'; p4 := 'posts/' || a || '/4.jpg';
  insert into storage.objects(bucket_id, name, owner_id) select 'community-media', x, a::text from unnest(array[p1, p2, p3, p4]) x;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes)
  select a, nb, 'community-media', x, 'image/jpeg', 10 from unnest(array[p1, p2, p3, p4]) x;
  post1 := (public.publish_post(gen_random_uuid(), 'general', 'one', 'neighborhood', array[p1]) ->> 'post_id')::uuid;
  post2 := (public.publish_post(gen_random_uuid(), 'general', 'two', 'neighborhood', array[p2]) ->> 'post_id')::uuid;
  post3 := (public.publish_post(gen_random_uuid(), 'general', 'three', 'neighborhood', array[p3]) ->> 'post_id')::uuid;
  post4a := (public.publish_post(gen_random_uuid(), 'general', 'four a', 'neighborhood', array[p4]) ->> 'post_id')::uuid;
  post4b := (public.publish_post(gen_random_uuid(), 'general', 'four b', 'neighborhood', array[p4]) ->> 'post_id')::uuid;
  perform public.delete_post(post1);
  perform public.delete_post(post2);
  perform public.delete_post(post4a);
  perform public.delete_post(post4b);
  -- p3's post stays live.

  perform set_config('role', 'postgres', true);
  -- 1. Within the grace nothing is taken, even when the job asks for a 1-hour window.
  update public.posts set deleted_at = now() - interval '2 hours' where id in (post1, post2, post4a, post4b);
  select coalesce(array_agg(object_path), '{}') into claimed from public.claim_abandoned_post_photos(interval '1 hour', 100, interval '1 hour');
  if claimed && array[p1, p2, p3, p4] then raise exception 'FAIL photo of a recently deleted post claimed: %', claimed; end if;
  r := public.count_abandoned_post_photos(interval '1 hour');
  if (r ->> 'deleted_post_photos')::int <> 0 then raise exception 'FAIL preview counts photos within the grace: %', r; end if;
  passed := passed + 1;

  -- 2. After the grace: p1 and p2 are due; p3 (live post) is not; p4 is not while one of its
  --    two deleted posts is still within the grace.
  update public.posts set deleted_at = now() - interval '25 hours' where id in (post1, post2, post4a);
  r := public.count_abandoned_post_photos(interval '1 hour');
  if (r ->> 'deleted_post_photos')::int < 2 then raise exception 'FAIL preview misses due photos: %', r; end if;
  select coalesce(array_agg(object_path), '{}') into claimed from public.claim_abandoned_post_photos(interval '1 hour', 100, interval '1 hour');
  if not (claimed @> array[p1, p2]) then raise exception 'FAIL due photos not claimed: %', claimed; end if;
  if claimed && array[p3] then raise exception 'FAIL photo of a live post claimed'; end if;
  if claimed && array[p4] then raise exception 'FAIL photo claimed while another deletion is within the grace'; end if;
  passed := passed + 1;

  -- 3. A claimed photo can never be published again.
  perform set_config('role', 'authenticated', true);
  begin perform public.publish_post(gen_random_uuid(), 'general', 'reuse', 'neighborhood', array[p1]); err := null;
  exception when others then err := sqlerrm; end;
  if err is distinct from 'photo_unavailable' then raise exception 'FAIL claimed photo republished: %', err; end if;
  perform set_config('role', 'postgres', true);
  passed := passed + 1;

  -- 4. After the Storage delete, finish drops the records; p3 and p4 keep theirs.
  perform public.finish_post_photo_cleanup(array[p1, p2], '{}');
  select count(*) into cnt from public.media_attachments where object_path in (p1, p2);
  if cnt <> 0 then raise exception 'FAIL records of deleted photos kept'; end if;
  select count(*) into cnt from public.media_attachments where object_path in (p3, p4) and status = 'attached';
  if cnt <> 2 then raise exception 'FAIL live or in-grace photo records changed'; end if;
  passed := passed + 1;

  -- 5. Once p4's last deletion passes the grace it becomes due too.
  update public.posts set deleted_at = now() - interval '25 hours' where id = post4b;
  select coalesce(array_agg(object_path), '{}') into claimed from public.claim_abandoned_post_photos(interval '24 hours', 100, interval '1 hour');
  if not (claimed @> array[p4]) then raise exception 'FAIL photo not due after its last deletion passed the grace'; end if;
  passed := passed + 1;

  raise exception 'ALL_PASS % checks (rolled back)', passed;
end $t$;
