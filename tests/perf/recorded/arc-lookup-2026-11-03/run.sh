#!/usr/bin/env bash
# Times a point at a length along a curve (packages/geom/src/along/along.bench.ts) with the arc-length
# lookup as at b05fc6009 (before: a 16-step table, a linear first guess, and Newton steps measured by
# segmentLength's refining rule) and as synced (after), ABBA rounds on one node. Run from the repo root as
#   onto do --kind bench --solo --expect 5m --out tests/perf/recorded/arc-lookup-2026-11-03 -- \
#     bash tests/perf/recorded/arc-lookup-2026-11-03/run.sh
# The source files are swapped in place and restored on exit; only the results stay. Results land in a
# directory named for `hostname -s`; msb-uai answers `Mac`, so its directory was renamed by hand. The
# studio-at-<sha> directories are earlier rounds, measuring the branch at that commit.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
base=b05fc6009
rounds="${ROUNDS:-4}"
files=(
  packages/geom/src/paths/segmentLength.ts packages/geom/src/paths/pathMeasure.ts
  packages/geom/src/along/bezier.ts packages/geom/src/along/positions.ts
  packages/geom/src/along/lengthTable.ts packages/geom/src/along/curvePosition.ts
)
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
pass() { # <label>
  echo "$1: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  npx tsx packages/geom/src/along/along.bench.ts --out "$out/runs.jsonl" --label "$1" > "$out/$1.log" 2>&1
  echo "$1: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}
echo "onto: plan $((rounds * 4))"
n=0
for r in $(seq 1 "$rounds"); do
  before; pass "before-$((2 * r - 1))"; echo "onto: progress $((++n))/$((rounds * 4))"
  synced; pass "after-$((2 * r - 1))"; echo "onto: progress $((++n))/$((rounds * 4))"
  synced; pass "after-$((2 * r))"; echo "onto: progress $((++n))/$((rounds * 4))"
  before; pass "before-$((2 * r))"; echo "onto: progress $((++n))/$((rounds * 4))"
done
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
