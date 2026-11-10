#!/bin/bash
# Concurrency drill for 20261110090000 (development database only).
# Real parallel sessions; synthetic accounts and files; removes its data at the end.
#   DB=haratna_test ./supabase/tests/concurrency/resilience_race.sh
set -u
DB=${DB:-haratna_test}
PSQL="psql -q -X -At -v ON_ERROR_STOP=1 -d $DB"
run() { su postgres -c "$PSQL" 2>&1; }
A=c0000000-0000-0000-0000-00000000000a
NB=sa-district-10500227013
OP=d0000000-0000-0000-0000-000000000001
OP2=d0000000-0000-0000-0000-000000000002
OP3=d0000000-0000-0000-0000-000000000003
as_a="set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$A\",\"role\":\"authenticated\"}', false);"
cleanup() {
  run <<SQL >/dev/null
set session_replication_role = replica;
delete from public.posts where author_id = '$A';
delete from public.media_attachments where owner_id = '$A';
delete from storage.objects where name like 'posts/$A/%';
delete from public.neighborhood_memberships where user_id = '$A';
delete from public.profiles where id = '$A';
delete from auth.users where id = '$A';
SQL
}
cleanup
run <<SQL >/dev/null
insert into auth.users(id, aud, role, email, instance_id) values ('$A','authenticated','authenticated','race@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at) values ('$A','$NB','verified',true,now());
insert into storage.objects(bucket_id, name, owner_id) values ('community-media','posts/$A/race1.jpg','$A'),('community-media','posts/$A/race2.jpg','$A');
insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes)
  values ('$A','$NB','community-media','posts/$A/race1.jpg','image/jpeg',1),('$A','$NB','community-media','posts/$A/race2.jpg','image/jpeg',1);
update public.media_attachments set created_at = now() - interval '2 days' where owner_id = '$A';
SQL
fail=0

echo "## 1. two simultaneous publishes, same op id (double tap / retry race)"
for i in 1 2; do
  ( echo "$as_a select public.publish_post('$OP','general','race','public',array['posts/$A/race1.jpg'])->>'outcome';" | run | tail -1 > /tmp/race_$i.out ) &
done; wait
o1=$(cat /tmp/race_1.out); o2=$(cat /tmp/race_2.out)
n=$(echo "select count(*) from public.posts where author_id='$A';" | run)
echo "outcomes: $o1, $o2; posts: $n"
[[ "$n" == "1" && "$o1 $o2" =~ created && "$o1 $o2" =~ existing ]] && echo PASS || { echo FAIL; fail=1; }

echo "## 2. cleanup runs while a publication holds the photo (publish first)"
( echo "$as_a begin; select public.publish_post('$OP2','general','slow','public',array['posts/$A/race2.jpg'])->>'outcome'; select pg_sleep(5); commit;" | run > /tmp/race_pub.out ) &
sleep 2
claimed=$(echo "select count(*) from public.claim_abandoned_post_photos(interval '1 hour', 100) c where c.object_path = 'posts/$A/race2.jpg';" | run)
wait
status=$(echo "select status from public.media_attachments where object_path='posts/$A/race2.jpg';" | run)
echo "publish: $(grep -m1 -E "created|existing|conflict|ERROR" /tmp/race_pub.out); cleanup claimed it: $claimed; final status: $status"
[[ "$claimed" == "0" && "$status" == "attached" ]] && echo PASS || { echo FAIL; fail=1; }

echo "## 3. publication arrives while cleanup holds the photo (cleanup first)"
run <<SQL >/dev/null
insert into storage.objects(bucket_id, name, owner_id) values ('community-media','posts/$A/race3.jpg','$A');
insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes, created_at)
  values ('$A','$NB','community-media','posts/$A/race3.jpg','image/jpeg',1, now() - interval '2 days');
SQL
( echo "begin; select count(*) from public.claim_abandoned_post_photos(interval '1 hour', 100) c where c.object_path='posts/$A/race3.jpg'; select pg_sleep(5); commit;" | run > /tmp/race_cl.out ) &
sleep 2
pub=$(echo "$as_a select public.publish_post('$OP3','general','late','public',array['posts/$A/race3.jpg'])->>'outcome';" | run | grep -m1 -E 'ERROR|created|existing|conflict')
wait
n=$(echo "select count(*) from public.posts where author_id='$A' and client_op_id='$OP3';" | run)
echo "cleanup claimed: $(head -1 /tmp/race_cl.out); publish result: ${pub##*ERROR:  }; post written: $n"
[[ "$pub" == *photo_unavailable* && "$n" == "0" ]] && echo PASS || { echo FAIL; fail=1; }

echo "## 4. no live post references a file that is gone or being deleted"
bad=$(echo "select count(*) from public.posts p cross join unnest(p.image_paths) x where p.author_id='$A' and p.deleted_at is null and (not exists (select 1 from storage.objects o where o.name = x) or exists (select 1 from public.media_attachments m where m.object_path = x and m.status <> 'attached'));" | run)
echo "dangling references: $bad"
[[ "$bad" == "0" ]] && echo PASS || { echo FAIL; fail=1; }

cleanup; rm -f /tmp/race_*.out
[[ $fail == 0 ]] && echo "RACE_ALL_PASS" || echo "RACE_FAILED"
exit $fail
