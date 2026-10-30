#!/usr/bin/env bash
# Runs clip-cost.spec.ts (its shader-clip-against-stencil agreement, now against even-odd fills) and
# tests/visual/batch-pixels.spec.ts on one node, as synced. Run from the repo root as
#   onto do --kind test --solo --gui --out tests/perf/recorded/vertex-color-batch-2026-10-30/checks -- \
#     bash tests/perf/recorded/vertex-color-batch-2026-10-30/checks/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
mkdir -p "$out"
cd "$root"
npm ci --no-audit --no-fund > /dev/null 2>&1
echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')" > "$out/conditions.txt"
echo "onto: plan 2"
mkdir -p "$out/clip-cost"
WEASEL_PERF_OUT="$out/clip-cost" WEASEL_PERF_PORT=33499 \
  npm run test:perf -- perf/clip-cost.spec.ts 2>&1 | tee "$out/clip-cost.log"
echo "onto: progress 1/2"
npx playwright test --config=tests/visual/playwright.config.ts batch-pixels 2>&1 | tee "$out/batch-pixels.log"
echo "onto: progress 2/2"
