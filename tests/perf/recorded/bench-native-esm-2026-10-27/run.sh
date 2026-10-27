#!/usr/bin/env bash
# Re-measures every tests/perf/bench/*.bench.ts into ./<node>/, then runs module-runner.sh, as run on studio with
#   onto do --kind bench --node studio --solo --out tests/perf/recorded/bench-native-esm-2026-10-27 -- \
#     bash tests/perf/recorded/bench-native-esm-2026-10-27/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
d="$here/$(hostname -s)"
mkdir -p "$d"
{
  echo "start: $(date -u +%FT%TZ)"
  echo "commit: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads, $(( $(sysctl -n hw.memsize) / 1073741824 )) GB)"
  echo "node: $(node -v)"
  echo "load before: $(sysctl -n vm.loadavg)"
} > "$d/conditions.txt"
npm run perf:bench -- --out "$d/result.json" --raw "$d/vitest-bench.json" --maxWorkers=1 2>&1 | tee "$d/bench.log"
{
  echo "load after: $(sysctl -n vm.loadavg)"
  echo "end: $(date -u +%FT%TZ)"
} >> "$d/conditions.txt"
bash "$here/module-runner.sh"
