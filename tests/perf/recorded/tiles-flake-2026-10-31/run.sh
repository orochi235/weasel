#!/usr/bin/env bash
# Tries to provoke retained.tiles.browser.test.ts's one sighting of tiled and whole differing by
# one level (teitou, 2026-10-29): runs the test file RUNS times, then probe.browser.test.ts, which
# draws its first case 300 times quiet and 300 times with another context loading the GPU, logging
# every difference with its pixels. Run from the repo root as
#   onto do --kind test --node teitou --out tests/perf/recorded/tiles-flake-2026-10-31 -- \
#     bash tests/perf/recorded/tiles-flake-2026-10-31/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
runs="${RUNS:-10}"
probe="$root/packages/renderer/src/retain/tiles-flake.probe.browser.test.ts"
trap 'rm -f "$probe"' EXIT
mkdir -p "$out"
cd "$root"
npm ci --no-audit --no-fund > "$out/npm-ci.log" 2>&1
gpu() { ioreg -r -d 1 -c IOAccelerator | grep -o '"Device Utilization %"=[0-9]*' | head -1; }
{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads)"
  echo "gpu: $(system_profiler SPDisplaysDataType 2>/dev/null | grep -m1 'Chipset Model' | sed 's/.*: //')"
  echo "node: $(node -v)"
} > "$out/conditions.txt"

echo "onto: plan $((runs + 1))"
for i in $(seq 1 "$runs"); do
  echo "test $i: load $(sysctl -n vm.loadavg) $(gpu)" >> "$out/conditions.txt"
  npx vitest run --project=browser --reporter=default packages/renderer/src/retain/retained.tiles.browser.test.ts \
    > "$out/test-$i.log" 2>&1 || echo "test $i: exit $?" >> "$out/conditions.txt"
  echo "onto: progress $i/$((runs + 1))"
done

cp "$here/probe.browser.test.ts" "$probe"
echo "probe: load $(sysctl -n vm.loadavg) $(gpu)" >> "$out/conditions.txt"
npx vitest run --project=browser --reporter=default "$probe" > "$out/probe.log" 2>&1 || echo "probe: exit $?" >> "$out/conditions.txt"
grep '^PROBE\|PROBE' "$out/probe.log" | sed 's/^.*\(PROBE\)/\1/' > "$out/probe.jsonl" || true
echo "probe: after $(sysctl -n vm.loadavg) $(gpu)" >> "$out/conditions.txt"
echo "onto: progress $((runs + 1))/$((runs + 1))"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
