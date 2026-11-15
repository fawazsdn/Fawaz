#!/bin/bash
T=~/Downloads/haratna-rc-worktrees/tools
B="neighbors compliance clubs poll_vote_change admin_support public_support"
ALL="$B social_follows private_profile_photos build13_compat social_resilience"
echo "### 1. baseline"; $T/reset_rehearsal.sh; $T/suites.sh rc_rehearsal $B
echo "### 2. apply 3 migrations"; $T/apply3.sh || exit 1; $T/suites.sh rc_rehearsal $ALL; $T/race.sh | tail -12
echo "### 3. roll back 090000"; $T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261110090000_social_resilience.sql | grep ERROR
$T/suites.sh rc_rehearsal $B social_follows private_profile_photos build13_compat
echo "### 4. roll back 130000 + 120000"
$T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261109130000_private_profile_photos.sql | grep ERROR
$T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261109120000_social_follows_photo_posts.sql | grep ERROR
$T/suites.sh rc_rehearsal $B
echo "### 5. re-apply all three"; $T/apply3.sh || exit 1; $T/suites.sh rc_rehearsal $ALL; $T/race.sh | tail -12
echo "### privilege sweep"
$T/dbq.sh rc_rehearsal "select p.proname, r from pg_proc p join pg_namespace n on n.oid=p.pronamespace, unnest(array['anon','authenticated','service_role']) r where n.nspname='public' and p.proname in ('publish_post','add_post_comment','claim_abandoned_post_photos','finish_post_photo_cleanup','count_abandoned_post_photos') and has_function_privilege(r, p.oid, 'execute') order by 1,2"
$T/dbq.sh rc_rehearsal "select 'authenticated has private USAGE: '||has_schema_privilege('authenticated','private','USAGE')"
