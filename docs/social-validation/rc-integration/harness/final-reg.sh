#!/bin/bash
T=~/Downloads/haratna-rc-worktrees/tools; cd $T; O=results/final-reg; mkdir -p $O
set -a; source local-keys.env; set +a; export NODE_PATH=../haratna-rc/node_modules
run() { CLS=$1 ./run-case.sh $2 > $O/$3.txt 2>&1; echo "$3: $(grep -E 'passed \(|failed \(' $O/$3.txt | sed -E 's/.*(passed|failed).*/\1/' | head -1)"; }
xcrun simctl ui 4579B8D7-ABB8-4BE0-9C74-CC4D7E297DCC content_size large
node rc-block.cjs unblock >/dev/null 2>&1
run RcCases test1_LostPostResponse lostpost
run RcFinal test10_TenPhotosSelectReorderPublish tenphotos
run RcFinal test13b_BlockThenNavigateAwayAndBack block-refocus
node rc-block.cjs unblock >/dev/null 2>&1
echo "rows lostpost: $(./rc-verify.sh 'RC r3lostpost' | head -1)"
P=$(./dbq.sh postgres "select array_to_string(image_paths, ' ') from public.posts where text_ar like 'RC tenphotos6%' and deleted_at is null") python3 -I - <<'PY'
import os, urllib.request, io
from PIL import Image
paths=os.environ['P'].split(); key=os.environ['LOCAL_SERVICE_KEY']; out=[]
for p in paths:
    req=urllib.request.Request('http://127.0.0.1:55421/storage/v1/object/community-media/'+p, headers={'Authorization':'Bearer '+key})
    w,h=Image.open(io.BytesIO(urllib.request.urlopen(req).read())).size
    out.append(round((w/h*800-600)/60))
print('tenphotos stored order:', out)
PY
./rehearsal4.sh > results/rehearsal4-final.log 2>&1
echo "rehearsal PASS=$(grep -c '^PASS' results/rehearsal4-final.log) FAIL=$(grep -c '^FAIL' results/rehearsal4-final.log) EXPECTED-FAIL=$(grep -c '^EXPECTED-FAIL' results/rehearsal4-final.log) RACE=$(grep -c RACE_ALL_PASS results/rehearsal4-final.log)"
echo FINAL_DONE
