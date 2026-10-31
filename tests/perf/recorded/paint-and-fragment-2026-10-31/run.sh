#!/usr/bin/env bash
# Breaks down two costs PERF.md left unexplained: what the shipping batch fragment spends beyond the
# fill-rate spec's stand-in (fill-rate.spec.ts, its batch-no-* knockouts), and where a staged
# pattern command's time goes against a gradient's and a solid's (paint-staging.spec.ts). One pass
# of each, on one node. Run from the repo root as
#   onto do --kind bench --solo --gui --out tests/perf/recorded/paint-and-fragment-2026-10-31 -- \
#     bash tests/perf/recorded/paint-and-fragment-2026-10-31/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
mkdir -p "$out"
cd "$root"
[ -d node_modules ] || npm ci --no-audit --no-fund > "$out/npm-ci.log" 2>&1
{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads)"
  echo "node: $(node -v)"
} > "$out/conditions.txt"
echo "onto: plan 2"
n=0
for name in fill-rate paint-staging; do
  echo "$name: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  WEASEL_PERF_OUT="$out" WEASEL_PERF_PORT=33491 npm run test:perf -- "perf/$name.spec.ts" > "$out/$name.log" 2>&1 \
    || echo "$name: exit $?" >> "$out/conditions.txt"
  echo "$name: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  n=$((n + 1)); echo "onto: progress $n/2"
done
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
