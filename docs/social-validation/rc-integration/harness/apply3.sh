#!/bin/bash
T=~/Downloads/haratna-rc-worktrees/tools
for m in 20261109120000_social_follows_photo_posts 20261109130000_private_profile_photos 20261110090000_social_resilience; do
  out=$($T/dbf.sh rc_rehearsal /tmp/rc/migrations/$m.sql | grep -E "ERROR"); [ -n "$out" ] && { echo "APPLY FAIL $m: $out"; exit 1; }; echo "applied $m"
done
