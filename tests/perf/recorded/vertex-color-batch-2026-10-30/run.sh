#!/usr/bin/env bash
# Times transition-matrix.spec.ts with per-vertex colors drawing for themselves (as at 707858878) and
# staged into the batch (as synced), in ABBA order on one node. Run from the repo root as
#   onto do --kind bench --solo --gui --out tests/perf/recorded/vertex-color-batch-2026-10-30 -- \
#     bash tests/perf/recorded/vertex-color-batch-2026-10-30/run.sh
# The source files are swapped in place and restored on exit; only the results stay.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
files=(packages/renderer/src/draw/batch.ts packages/renderer/src/draw/gradient.ts
  packages/renderer/src/draw/pathPaint.ts packages/renderer/src/drawBatch.ts)
keep="$(mktemp -d)"
mkdir -p "$out"
for f in "${files[@]}"; do mkdir -p "$keep/$(dirname "$f")"; cp "$root/$f" "$keep/$f"; done
synced() { for f in "${files[@]}"; do cp "$keep/$f" "$root/$f"; done; }
before() { for f in "${files[@]}"; do git -C "$root" show "707858878:$f" > "$root/$f"; done; }
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
  WEASEL_PERF_OUT="$out/$label" WEASEL_PERF_PORT=33499 \
    npm run test:perf -- perf/transition-matrix.spec.ts 2>&1 | tee "$out/$label.log"
  echo "$label: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}

echo "onto: plan 4"
before; spec before-1; echo "onto: progress 1/4"
synced; spec after-1; echo "onto: progress 2/4"
synced; spec after-2; echo "onto: progress 3/4"
before; spec before-2; echo "onto: progress 4/4"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
