#!/bin/bash
# A/B driver: interleaves main, portal-only, and portal+axe-mock.
set -e
BASE=4cb4ac958
OUT=tests/perf/recorded/forge-mount-2026-10-30/runs.jsonl
P=packages/ui/src/overlays/portalHost.tsx
T=packages/forge/src/timeline/timeline.test.tsx
S=$(mktemp -d)
cp $P $S/p; cp $T $S/t
for round in 1 2 3 4 5; do
  git show $BASE:$P > $P; git show $BASE:$T > $T
  node tests/perf/forge-mount.mjs main 1 $OUT
  cp $S/p $P
  node tests/perf/forge-mount.mjs portal 1 $OUT
  cp $S/t $T
  node tests/perf/forge-mount.mjs portal+axe 1 $OUT
done
