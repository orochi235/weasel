#!/usr/bin/env bash
# Times clip-cost.spec.ts with draw/alignedRibbon.ts as at 3a764aca4 (before) and as synced (after),
# in ABBA order on one node. Before, an aligned stroke on a notched quad (`astroke-notch-inner`,
# `-outer`) draws through the stencil; after, it is cut to the fill's triangles and joins the run.
# Run from the repo root as
#   onto do --kind bench --solo --gui --expect 15m --out tests/perf/recorded/nonconvex-stroke-2026-10-31 -- \
#     bash tests/perf/recorded/nonconvex-stroke-2026-10-31/run.sh
# The source file is swapped in place and restored on exit; only the results stay.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
base=3a764aca4
files=(packages/renderer/src/draw/alignedRibbon.ts)
keep="$(mktemp -d)"
mkdir -p "$out"
for f in "${files[@]}"; do mkdir -p "$keep/$(dirname "$f")"; cp "$root/$f" "$keep/$f"; done
synced() { for f in "${files[@]}"; do cp "$keep/$f" "$root/$f"; done; }
before() { for f in "${files[@]}"; do git -C "$root" show "$base:$f" > "$root/$f"; done; }
trap 'synced; rm -rf "$keep"' EXIT

cd "$root"
npm ci --no-audit --no-fund > "$out/npm-ci.log" 2>&1
{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads)"
  echo "node: $(node -v)"
} > "$out/conditions.txt"

pass() { # <label>
  local label="$1"
  echo "$label clip-cost: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  mkdir -p "$out/$label"
  WEASEL_PERF_OUT="$out/$label" WEASEL_PERF_PORT=33491 \
    npm run test:perf -- perf/clip-cost.spec.ts > "$out/$label.clip-cost.log" 2>&1 || echo "$label clip-cost: exit $?" >> "$out/conditions.txt"
  echo "$label clip-cost: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}

echo "onto: plan 4"
before; pass before-1; echo "onto: progress 1/4"
synced; pass after-1; echo "onto: progress 2/4"
synced; pass after-2; echo "onto: progress 3/4"
before; pass before-2; echo "onto: progress 4/4"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
