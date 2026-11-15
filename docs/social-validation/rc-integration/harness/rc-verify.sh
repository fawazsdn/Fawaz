#!/bin/bash
# usage: rc-verify.sh <text-marker>  -> rows written by fixture accounts containing the marker
T=~/Downloads/haratna-rc-worktrees/tools
A=$(python3 -c "import json;print(json.load(open('$T/rc-fixture.json'))['accounts']['a']['id'])")
B=$(python3 -c "import json;print(json.load(open('$T/rc-fixture.json'))['accounts']['b']['id'])")
M="$1"
$T/dbq.sh postgres "select 'posts_A='||count(*) filter (where author_id='$A')||' posts_B='||count(*) filter (where author_id='$B')||' photos='||coalesce(sum(cardinality(image_paths)),0) from public.posts where text_ar like '%$M%' and deleted_at is null"
$T/dbq.sh postgres "select 'comments_A='||count(*) filter (where author_id='$A')||' comments_B='||count(*) filter (where author_id='$B') from public.post_comments where body like '%$M%'"
$T/dbq.sh postgres "select 'notifications_for_B='||count(*) from public.notifications where user_id='$B' and created_at > now() - interval '10 minutes'" 2>/dev/null
$T/dbq.sh postgres "select 'A_uploads: '||coalesce(string_agg(status||'='||n, ' '),'none') from (select status, count(*) n from public.media_attachments where owner_id='$A' group by 1) s"
$T/dbq.sh postgres "select 'A_storage_objects='||count(*) from storage.objects where bucket_id='community-media' and name like 'posts/$A/%'"
$T/dbq.sh postgres "select 'dangling_refs='||count(*) from public.posts p cross join unnest(p.image_paths) x where p.author_id in ('$A','$B') and p.deleted_at is null and not exists (select 1 from storage.objects o where o.bucket_id='community-media' and o.name=x)"
