#!/usr/bin/env bash
# Times stroke tessellation (bench/tessellate.bench.ts) and a frame of 512 stroked quads
# (clip-cost.spec.ts's astroke-* frames) with the ribbon as at a24f80b93 (before: the segments at a
# join overlap inside the turn) and as synced (after: they meet at the inner corner), ABBA on one
# node. Run from the repo root as
#   onto do --kind bench --solo --gui --out tests/perf/recorded/stroke-inner-joins-2026-10-31 -- \
#     bash tests/perf/recorded/stroke-inner-joins-2026-10-31/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
base=a24f80b93
files=(packages/stroke/src/tessellate/ribbon.ts packages/stroke/src/tessellate/stroke.ts)
keep="$(mktemp -d)"
for f in "${files[@]}"; do mkdir -p "$keep/$(dirname "$f")"; cp "$root/$f" "$keep/$f"; done
synced() { for f in "${files[@]}"; do cp "$keep/$f" "$root/$f"; done; }
before() { for f in "${files[@]}"; do git -C "$root" show "$base:$f" > "$root/$f"; done; }
trap 'synced; rm -rf "$keep"' EXIT
mkdir -p "$out"
cd "$root"
{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads)"
  echo "node: $(node -v)"
} > "$out/conditions.txt"
pass() {
  echo "$1: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  mkdir -p "$out/$1"
  npm run perf:bench -- --raw "$out/$1/tessellate-bench.json" tests/perf/bench/tessellate.bench.ts > "$out/$1.bench.log" 2>&1
  WEASEL_PERF_OUT="$out/$1" WEASEL_PERF_PORT=33491 npm run test:perf -- perf/clip-cost.spec.ts > "$out/$1.clip-cost.log" 2>&1
  echo "$1: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}
echo "onto: plan 4"
before; pass before-1; echo "onto: progress 1/4"
synced; pass after-1; echo "onto: progress 2/4"
synced; pass after-2; echo "onto: progress 3/4"
before; pass before-2; echo "onto: progress 4/4"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
