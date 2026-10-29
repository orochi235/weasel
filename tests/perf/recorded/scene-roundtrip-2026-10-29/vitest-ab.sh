#!/usr/bin/env bash
# Runs scene-ops.bench.ts at <before-sha> (a detached checkout) and on the synced tree, alternating,
# ROUNDS times each, into <pass>/<node>/: one vitest JSON and log per run. Run from the repo root as
#   onto do --kind bench --solo --expect 15m --out tests/perf/recorded/scene-roundtrip-2026-10-29/<pass> -- \
#     bash tests/perf/recorded/scene-roundtrip-2026-10-29/vitest-ab.sh <pass> <before-sha>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
pass="$1" before="$2"
out="$here/$pass/$(hostname -s)"
trees="$root/.bench-trees"
rounds="${ROUNDS:-3}"
mkdir -p "$out" "$trees"
cleanup() {
  for t in "$trees"/*; do [ -d "$t" ] && git -C "$root" worktree remove --force "$t" || true; done
  rm -rf "$trees"
}
trap cleanup EXIT
git -C "$root" cat-file -e "$before^{commit}" 2>/dev/null || git -C "$root" fetch --quiet origin
git -C "$root" worktree add --detach --force "$trees/$before" "$before" > /dev/null

{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git -C "$root" rev-parse HEAD) dirty-paths: $(git -C "$root" status --porcelain | wc -l | tr -d ' ')"
  echo "before: $before"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads, $(( $(sysctl -n hw.memsize) / 1073741824 )) GB)"
  echo "node: $(node -v)"
} > "$out/conditions.txt"

for r in $(seq 1 "$rounds"); do
  for side in before after; do
    tree="$root"; [ "$side" = before ] && tree="$trees/$before"
    echo "$side r$r: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
    (cd "$tree" && npx vitest bench --run --config tests/perf/vitest.bench.config.ts --maxWorkers=1 \
      --reporter=default --reporter=json "--outputFile.json=$out/$side-r$r.json" \
      tests/perf/bench/scene-ops.bench.ts) > "$out/$side-r$r.log" 2>&1
    echo "$((2 * (r - 1) + $([ "$side" = before ] && echo 1 || echo 2)))/$((2 * rounds)) $side r$r done"
  done
done
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
