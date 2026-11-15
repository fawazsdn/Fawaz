#!/bin/bash
T=~/Downloads/haratna-rc-worktrees/tools; cd $T; S2=4579B8D7-ABB8-4BE0-9C74-CC4D7E297DCC; O=results/batch2; mkdir -p $O
run() { CLS=$1 ./run-case.sh $2 > $O/$3.txt 2>&1; echo "$3: $(grep -E 'passed \(|failed \(' $O/$3.txt | sed -E 's/.*(passed|failed).*/\1/' | head -1)"; }
xcrun simctl ui $S2 content_size accessibility-extra-extra-extra-large; run RcFinal test12_LargeTextScreens large-ar
xcrun simctl ui $S2 content_size large; run RcFinal test11_AccessibilityAudit audit-normal-ar
run RcFinal test14_SwitchToEnglish lang-en
xcrun simctl ui $S2 content_size accessibility-extra-extra-extra-large; run RcFinal test12_LargeTextScreens large-en
xcrun simctl ui $S2 content_size large; run RcFinal test11_AccessibilityAudit audit-normal-en
run RcFinal test15_SwitchToArabic lang-ar
echo BATCH2_DONE
