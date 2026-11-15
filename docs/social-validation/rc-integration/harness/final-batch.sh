#!/bin/bash
# Native batch for the privacy and accessibility round. Writes results/batch/*.txt
T=~/Downloads/haratna-rc-worktrees/tools; cd $T; S2=4579B8D7-ABB8-4BE0-9C74-CC4D7E297DCC; O=results/batch; mkdir -p $O
set -a; source local-keys.env; set +a; export NODE_PATH=../haratna-rc/node_modules
run() { CLS=$1 ./run-case.sh $2 > $O/$3.txt 2>&1; echo "$3: $(grep -E 'passed \(|failed \(' $O/$3.txt | sed -E 's/.*(passed|failed).*/\1/' | head -1)"; }
xcrun simctl ui $S2 content_size large
node rc-block.cjs unblock >/dev/null 2>&1
run RcFinal test13b_BlockThenNavigateAwayAndBack privacy-block-refocus
node rc-block.cjs unblock >/dev/null 2>&1
run RcFinal test11_AccessibilityAudit a11y-audit-normal-ar
xcrun simctl ui $S2 content_size accessibility-extra-extra-extra-large
run RcFinal test12_LargeTextScreens large-ar
xcrun simctl ui $S2 content_size large
run RcFinal test14_SwitchToEnglish lang-en
run RcFinal test11_AccessibilityAudit a11y-audit-normal-en
xcrun simctl ui $S2 content_size accessibility-extra-extra-extra-large
run RcFinal test12_LargeTextScreens large-en
xcrun simctl ui $S2 content_size large
run RcFinal test15_SwitchToArabic lang-ar
for c in test1_LostPostResponse test2_LostCommentResponse test3_RapidTaps test5_AccountSwitch test8_PostingPausedEnglishArabic; do run RcCases $c reg-$c; done
run RcFinal test10_TenPhotosSelectReorderPublish reg-tenphotos
echo BATCH_DONE
