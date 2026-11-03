#!/bin/sh
# The `browser` project alone, alternating between HEAD's files ("before") and the tree's uncommitted edits
# ("after"), each state with its own vite cache: a warm-up of each, then three runs of each. Rows go to
# .bench/browser-ab/runs.jsonl, `rep` 0 being the warm-up; append them to scripts/bench-browser-project.runs.jsonl.
#
#   onto do --kind bench --task <name> --node teitou --solo --expect 25m --timeout 50m \
#     --out .bench/browser-ab -- sh scripts/bench-browser-project-ab.sh
set -e
node=$(hostname -s)
out=.bench/browser-ab
A=.bench/ab
files=$(git diff --name-only HEAD | grep -v '^scripts/bench-browser-project')
echo "$(echo "$files" | wc -l) files differ"
rm -rf "$A" "$out"; mkdir -p "$A/after" "$A/before" "$out"
for f in $files; do
  mkdir -p "$A/after/$(dirname "$f")" "$A/before/$(dirname "$f")"
  cp -p "$f" "$A/after/$f"
  git show "HEAD:$f" > "$A/before/$f"
  # The prebundle re-bundles on a bundled file's mtime, so each state keeps one.
  touch -r "$f" "$A/before/$f"
done
cur=after
use() {
  for f in $files; do cp -p "$A/$1/$f" "$f"; done
  if [ -d node_modules/.vite-browser ]; then rm -rf "node_modules/.vite-browser-$cur"; mv node_modules/.vite-browser "node_modules/.vite-browser-$cur"; fi
  if [ -d "node_modules/.vite-browser-$1" ]; then mv "node_modules/.vite-browser-$1" node_modules/.vite-browser; fi
  cur=$1
}
for r in 0 1 2 3; do
  for state in before after; do
    use $state
    node scripts/bench-browser-project.mjs --node "$node" --variants bundled --reps 1 --label "$state" --out "$out/r$r"
  done
done
use after
for r in 0 1 2 3; do sed "s/\"rep\":1,/\"rep\":$r,/" "$out/r$r/runs.jsonl"; done > "$out/runs.jsonl"
