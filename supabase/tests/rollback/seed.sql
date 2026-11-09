-- Committed sample data for the rollback/restore drill (local replica only).
-- Accounts r1..r4 in one neighborhood; r1 public with a legacy photo already
-- copied, r2 private (its public link archived), r3 private-only photo.
insert into auth.users(id, aud, role, email, instance_id) values
 ('a0000000-0000-0000-0000-000000000001','authenticated','authenticated','r1@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('a0000000-0000-0000-0000-000000000002','authenticated','authenticated','r2@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('a0000000-0000-0000-0000-000000000003','authenticated','authenticated','r3@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('a0000000-0000-0000-0000-000000000004','authenticated','authenticated','r4@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
select ('a0000000-0000-0000-0000-00000000000' || i)::uuid, 'sa-district-10500227013', 'verified', true, now() from generate_series(1,4) i;
update public.profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/a0000000-0000-0000-0000-000000000001/one.jpg',
  avatar_path = 'a0000000-0000-0000-0000-000000000001/legacy-one.jpg' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/a0000000-0000-0000-0000-000000000002/two.jpg',
  avatar_path = 'a0000000-0000-0000-0000-000000000002/legacy-two.jpg' where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set is_private = true where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set avatar_path = 'a0000000-0000-0000-0000-000000000003/new.jpg' where id = 'a0000000-0000-0000-0000-000000000003';
insert into storage.objects(bucket_id, name, owner_id) values
 ('profile-photos','a0000000-0000-0000-0000-000000000001/legacy-one.jpg','a0000000-0000-0000-0000-000000000001'),
 ('profile-photos','a0000000-0000-0000-0000-000000000002/legacy-two.jpg','a0000000-0000-0000-0000-000000000002'),
 ('profile-photos','a0000000-0000-0000-0000-000000000003/new.jpg','a0000000-0000-0000-0000-000000000003');
insert into public.follows(follower_id, followee_id, status, accepted_at) values
 ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','accepted', now()),
 ('a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002','pending', null),
 ('a0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','accepted', now());
insert into public.notifications(user_id, actor_id, type, title_ar, body_ar, deep_link) values
 ('a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','follow_request','t','b','/profile/a0000000-0000-0000-0000-000000000003');
insert into public.posts(id, type, author_id, neighborhood_id, text_ar, audience, image_paths) values
 ('b0000000-0000-0000-0000-000000000001','general','a0000000-0000-0000-0000-000000000001','sa-district-10500227013','pub','public', array['posts/a0000000-0000-0000-0000-000000000001/p.jpg']),
 ('b0000000-0000-0000-0000-000000000002','general','a0000000-0000-0000-0000-000000000002','sa-district-10500227013','fol','followers', '{}'),
 ('b0000000-0000-0000-0000-000000000003','general','a0000000-0000-0000-0000-000000000003','sa-district-10500227013','nb','neighborhood', '{}');
