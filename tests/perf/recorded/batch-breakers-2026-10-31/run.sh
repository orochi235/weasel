#!/usr/bin/env bash
# Times clip-cost.spec.ts and transition-matrix.spec.ts with the renderer and the tessellator as at
# bab3c623e (before) and as synced (after), in ABBA order on one node. Before, a crossing or touching
# even-odd fill, a convex clip on a multisampled canvas, and an aligned stroke on a convex fill each
# draw through the stencil; after, all three join the run. transition-matrix runs with kinds.ts as at
# bab3c623e, whose `stencil` kind is an even-odd ring touched by a contour of no area: the fill this
# change batches. Run from the repo root as
#   onto do --kind bench --solo --gui --out tests/perf/recorded/batch-breakers-2026-10-31 -- \
#     bash tests/perf/recorded/batch-breakers-2026-10-31/run.sh
# The source files are swapped in place and restored on exit; only the results stay.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
base=bab3c623e
files=(
  packages/geom/src/tessellate/crossings.ts packages/geom/src/tessellate/index.ts
  packages/geom/src/tessellate/mesh.ts packages/geom/src/tessellate/tessellate.ts
  packages/renderer/src/batchClip.ts packages/renderer/src/batchHull.ts
  packages/renderer/src/draw/clip.ts packages/renderer/src/draw/colorGlyphs.ts
  packages/renderer/src/draw/drawContext.ts packages/renderer/src/draw/image.ts
  packages/renderer/src/draw/pathPaint.ts packages/renderer/src/draw/text.ts
  packages/renderer/src/drawBatch.ts packages/renderer/src/shaders/builtinPrograms.ts
)
kinds=tests/perf/lib/kinds.ts
keep="$(mktemp -d)"
mkdir -p "$out"
for f in "${files[@]}" "$kinds"; do mkdir -p "$keep/$(dirname "$f")"; cp "$root/$f" "$keep/$f"; done
synced() { for f in "${files[@]}"; do cp "$keep/$f" "$root/$f"; done; }
before() { for f in "${files[@]}"; do git -C "$root" show "$base:$f" > "$root/$f"; done; }
trap 'synced; cp "$keep/$kinds" "$root/$kinds"; rm -rf "$keep"' EXIT

cd "$root"
npm ci --no-audit --no-fund > "$out/npm-ci.log" 2>&1
{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads)"
  echo "node: $(node -v)"
} > "$out/conditions.txt"

spec() { # <label> <spec>
  local label="$1" name="$2"
  echo "$label $name: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  mkdir -p "$out/$label"
  WEASEL_PERF_OUT="$out/$label" WEASEL_PERF_PORT=33491 \
    npm run test:perf -- "perf/$name.spec.ts" > "$out/$label.$name.log" 2>&1 || echo "$label $name: exit $?" >> "$out/conditions.txt"
  echo "$label $name: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}
pass() { # <label>
  spec "$1" clip-cost
  git -C "$root" show "$base:$kinds" > "$root/$kinds"
  spec "$1" transition-matrix
  cp "$keep/$kinds" "$root/$kinds"
}

echo "onto: plan 4"
before; pass before-1; echo "onto: progress 1/4"
synced; pass after-1; echo "onto: progress 2/4"
synced; pass after-2; echo "onto: progress 3/4"
before; pass before-2; echo "onto: progress 4/4"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
