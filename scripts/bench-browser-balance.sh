#!/bin/sh
# The `browser` project alone in one process, its tabs dealt across Chromiums (`scripts/vitest-browser-spread.mjs`),
# at each CHROMIUMSxTABS given, alternated for REPS passes. Rows go to .bench/browser-balance/runs.jsonl; append
# them to scripts/bench-browser-project.runs.jsonl.
#
#   onto do --kind bench --task <name> --node teitou --solo --expect 15m --timeout 35m \
#     --out .bench/browser-balance -- sh scripts/bench-browser-balance.sh 6x3 9x2
set -e
node=$(hostname -s)
out=.bench/browser-balance
reps=${REPS:-1}
rm -rf "$out"; mkdir -p "$out"
r=1
while [ "$r" -le "$reps" ]; do
  for shape in "$@"; do
    node scripts/bench-browser-project.mjs --node "$node" --variants bundled --processes "${shape%x*}" --tabs "${shape#*x}" \
      --split spread --label "spread-$shape-r$r" --out "$out/r$r-$shape"
  done
  r=$((r + 1))
done
cat "$out"/r*/runs.jsonl > "$out/runs.jsonl"
