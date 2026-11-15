#!/bin/bash
# Rebuild rc_rehearsal from the synthetic-stack backup, roll back to the production baseline, seed moderation terms.
export DOCKER_HOST=unix://$HOME/.colima/haratna-backup/docker.sock
C=supabase_db_haratna-social-synthetic; T=~/Downloads/haratna-rc-worktrees/tools
docker exec $C rm -rf /tmp/rc && docker cp ~/Downloads/haratna-rc-worktrees/haratna-rc/supabase $C:/tmp/rc
docker cp $T/seed_terms.sql $C:/tmp/seed_terms.sql
docker exec $C psql -U supabase_admin -d postgres -q -c "drop database if exists rc_rehearsal" -c "create database rc_rehearsal"
docker exec $C pg_restore -U supabase_admin -d rc_rehearsal /tmp/base.dump 2>&1 | grep -i error
$T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261109130000_private_profile_photos.sql | grep -vE "transaction in progress|NOTICE"
$T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261109120000_social_follows_photo_posts.sql | grep -vE "transaction in progress|NOTICE"
$T/dbf.sh rc_rehearsal /tmp/seed_terms.sql
echo "reset done: follow funcs=$($T/dbq.sh rc_rehearsal "select count(*) from pg_proc where proname in ('follow_user','publish_post')") terms=$($T/dbq.sh rc_rehearsal "select count(*) from public.moderation_terms")"
