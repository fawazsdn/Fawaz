#!/bin/bash
T=~/Downloads/haratna-rc-worktrees/tools
B="neighbors compliance clubs poll_vote_change admin_support public_support"
S3="social_follows private_profile_photos build13_compat social_resilience"
echo "### 1. baseline"; $T/reset_rehearsal.sh; $T/suites.sh rc_rehearsal $B
echo "### 2. apply 4 migrations"; $T/apply4.sh || exit 1; $T/suites.sh rc_rehearsal $B $S3 private_profile_audience; $T/race.sh | tail -1
echo "### 3. roll back 20261115100000 (audience suite must FAIL again: old rule restored)"
$T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261115100000_private_profile_audience.sql | grep ERROR
$T/suites.sh rc_rehearsal $B $S3; $T/suites.sh rc_rehearsal private_profile_audience | sed 's/^FAIL/EXPECTED-FAIL/'
echo "### 4. roll back 090000"; $T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261110090000_social_resilience.sql | grep ERROR
$T/suites.sh rc_rehearsal $B social_follows private_profile_photos build13_compat
echo "### 5. roll back 130000 + 120000"
$T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261109130000_private_profile_photos.sql | grep ERROR
$T/dbf.sh rc_rehearsal /tmp/rc/rollbacks/20261109120000_social_follows_photo_posts.sql | grep ERROR
$T/suites.sh rc_rehearsal $B
echo "### 6. re-apply all four"; $T/apply4.sh || exit 1; $T/suites.sh rc_rehearsal $B $S3 private_profile_audience; $T/race.sh | tail -1
echo "### privilege sweep"
$T/dbq.sh rc_rehearsal "select 'authenticated has private USAGE: '||has_schema_privilege('authenticated','private','USAGE')"
$T/dbq.sh rc_rehearsal "select 'client-callable private.profile_visible*: '||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'profile_visible%' and (has_function_privilege('anon', p.oid, 'execute'))"
