#!/bin/bash
# usage: run-case.sh <testName>  -> runs one XCTest case on the fresh iPhone 18 Pro (RC build)
cd ~/Downloads/haratna-rc-worktrees/tools
xcodebuild test-without-building -project rc-walkthrough/RcWalkthrough.xcodeproj -scheme RcWalkthrough \
  -destination 'id=4579B8D7-ABB8-4BE0-9C74-CC4D7E297DCC' -derivedDataPath rcw-derived \
  -resultBundlePath results/$1-$(date +%H%M%S).xcresult -only-testing:RcWalkthrough/RcCases/$1 2>&1 \
  | grep -E "ALERT|PAUSED|_BUTTONS|SB_ALERTS|error:|failed \(|passed \(" | head -12
grep -E "MODE|COMMITTED|DROP|NOFUNC|CLEANUP|rpc/" rc-proxy.log | tail -12
