#!/bin/bash
# usage: suites.sh <db> <suite> [suite...]  -> one line per suite: PASS/FAIL + marker line
db=$1; shift; fail=0
for s in "$@"; do
  out=$(~/Downloads/haratna-rc-worktrees/tools/dbf.sh "$db" "/tmp/rc/tests/$s.sql" postgres)
  line=$(echo "$out" | grep -m1 -oE '(ALL_PASS|FAIL)[^"]*' )
  if echo "$out" | grep -q ALL_PASS; then echo "PASS $s :: $line"; else echo "FAIL $s :: $(echo "$out" | grep -E 'ERROR|FAIL' | head -2)"; fail=1; fi
done; exit $fail
