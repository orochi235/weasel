#!/usr/bin/env bash
# Times paint-staging.spec.ts with patternTileSpace composed through mat3 (as at its parent) and
# written out (as synced), in ABBA order on one node. Run from the repo root as
#   onto do --kind bench --solo --gui --out tests/perf/recorded/pattern-tile-space-2026-10-31 -- \
#     bash tests/perf/recorded/pattern-tile-space-2026-10-31/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
f=packages/renderer/src/math/patternSpace.ts
base="$(git -C "$root" log -1 --format=%H -- "$f")~1"
keep="$(mktemp)"
cp "$root/$f" "$keep"
trap 'cp "$keep" "$root/$f"; rm -f "$keep"' EXIT
mkdir -p "$out"
cd "$root"
{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ') before: $(git rev-parse "$base")"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads)"
} > "$out/conditions.txt"
spec() {
  echo "$1: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  mkdir -p "$out/$1"
  WEASEL_PERF_OUT="$out/$1" WEASEL_PERF_PORT=33491 npm run test:perf -- perf/paint-staging.spec.ts > "$out/$1.log" 2>&1
}
echo "onto: plan 4"
git show "$base:$f" > "$f"; spec before-1; echo "onto: progress 1/4"
cp "$keep" "$f"; spec after-1; echo "onto: progress 2/4"
spec after-2; echo "onto: progress 3/4"
git show "$base:$f" > "$f"; spec before-2; echo "onto: progress 4/4"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
