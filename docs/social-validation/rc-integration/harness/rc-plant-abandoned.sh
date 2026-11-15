#!/bin/bash
# Plants one abandoned (staged, 2-day-old, unreferenced) upload for fixture account A. Loopback stack only.
T=~/Downloads/haratna-rc-worktrees/tools; source $T/local-keys.env
A=$(python3 -c "import json;print(json.load(open('$T/rc-fixture.json'))['accounts']['a']['id'])")
P="posts/$A/rc-abandoned-$(date +%s).jpg"
curl -s -o /dev/null -w "upload %{http_code}\n" -X POST "http://127.0.0.1:55421/storage/v1/object/community-media/$P" \
  -H "Authorization: Bearer $LOCAL_SERVICE_KEY" -H "Content-Type: image/jpeg" --data-binary @$T/media/rc-synthetic-1.jpg
$T/dbq.sh postgres "insert into public.media_attachments(owner_id, neighborhood_id, bucket_id, object_path, mime_type, size_bytes, created_at)
  values ('$A','sa-district-10500227013','community-media','$P','image/jpeg',1, now() - interval '2 days') returning 'planted '||status"
echo "$P" > $T/results/abandoned-path.txt
