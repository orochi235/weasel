#!/usr/bin/env bash
# Times transition-matrix.spec.ts with even-odd fills on the stencil (as at a4e2edf3f) and
# triangulated into the batch where their outlines never meet (as synced), in ABBA order on
# one node. The spec's `stencil` kind was a square ring then, which the change batches.
# Run from the repo root as
#   onto do --kind bench --solo --gui --out tests/perf/recorded/evenodd-batch-2026-10-30 -- \
#     bash tests/perf/recorded/evenodd-batch-2026-10-30/run.sh
# The source files are swapped in place and restored on exit; only the results stay.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
base=a4e2edf3f
files=(packages/geom/src/tessellate/tessellate.ts packages/renderer/src/draw/stencil.ts)
keep="$(mktemp -d)"
mkdir -p "$out"
for f in "${files[@]}"; do mkdir -p "$keep/$(dirname "$f")"; cp "$root/$f" "$keep/$f"; done
# The ring the measurement was taken with, whatever the synced tree's kinds.ts says.
git -C "$root" show "bfeb67040:tests/perf/lib/kinds.ts" > "$keep/kinds.ts"
cp "$root/tests/perf/lib/kinds.ts" "$keep/kinds.synced.ts"
cp "$keep/kinds.ts" "$root/tests/perf/lib/kinds.ts"
synced() { for f in "${files[@]}"; do cp "$keep/$f" "$root/$f"; done; }
before() { for f in "${files[@]}"; do git -C "$root" show "$base:$f" > "$root/$f"; done; }
trap 'synced; cp "$keep/kinds.synced.ts" "$root/tests/perf/lib/kinds.ts"; rm -rf "$keep"' EXIT

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
    npm run test:perf -- perf/transition-matrix.spec.ts 2>&1 | tee "$out/$label.log"
  echo "$label: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}

echo "onto: plan 4"
before; spec before-1; echo "onto: progress 1/4"
synced; spec after-1; echo "onto: progress 2/4"
synced; spec after-2; echo "onto: progress 3/4"
before; spec before-2; echo "onto: progress 4/4"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
