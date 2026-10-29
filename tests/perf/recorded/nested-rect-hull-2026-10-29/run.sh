#!/usr/bin/env bash
# Times clip-cost.spec.ts with the hull clip code before meetHulls (as at 4d5f3483e) and as
# synced, alternating, two passes each, on one node. Run from the repo root as
#   onto do --kind bench --solo --gui --out tests/perf/recorded/nested-rect-hull-2026-10-29 -- \
#     bash tests/perf/recorded/nested-rect-hull-2026-10-29/run.sh
# The two source files are swapped in place and restored on exit; only the results stay.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
files=(packages/renderer/src/batchHull.ts packages/renderer/src/draw/clip.ts)
keep="$(mktemp -d)"
mkdir -p "$out"
for f in "${files[@]}"; do mkdir -p "$keep/$(dirname "$f")"; cp "$root/$f" "$keep/$f"; done
synced() { for f in "${files[@]}"; do cp "$keep/$f" "$root/$f"; done; }
before() { for f in "${files[@]}"; do git -C "$root" show "4d5f3483e:$f" > "$root/$f"; done; }
trap 'synced; rm -rf "$keep"' EXIT

cd "$root"
npm ci --no-audit --no-fund > "$out/npm-ci.log" 2>&1
{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads)"
  echo "node: $(node -v)"
} > "$out/conditions.txt"

spec() { # <label>
  local label="$1"
  echo "$label: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  mkdir -p "$out/$label"
  WEASEL_PERF_OUT="$out/$label" WEASEL_PERF_PORT=33497 \
    npm run test:perf -- perf/clip-cost.spec.ts 2>&1 | tee "$out/$label.log"
  echo "$label: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}

echo "onto: plan 4"
n=0
for pass in 1 2; do
  before; spec "before-$pass"; n=$((n + 1)); echo "onto: progress $n/4"
  synced; spec "after-$pass"; n=$((n + 1)); echo "onto: progress $n/4"
done
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
