#!/usr/bin/env bash
# Runs every bench under the config this directory's run replaced (Vite's module runner,
# from 7ebac8de0), on the same tree, into ./<node>-module-runner/: separates what the runner
# cost from what the code did since the 2026-09-29 baseline. run.sh runs it after its own run.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
d="$here/$(hostname -s)-module-runner"
cfg="$root/tests/perf/vitest.bench.module-runner.config.ts"
mkdir -p "$d"
git -C "$root" show 7ebac8de0:tests/perf/vitest.bench.config.ts > "$cfg"
trap 'rm -f "$cfg"' EXIT
{
  echo "start: $(date -u +%FT%TZ)"
  echo "commit: $(git -C "$root" rev-parse HEAD) dirty-paths: $(git -C "$root" status --porcelain | wc -l | tr -d ' ')"
  echo "config: tests/perf/vitest.bench.config.ts at 7ebac8de0"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads, $(( $(sysctl -n hw.memsize) / 1073741824 )) GB)"
  echo "node: $(node -v)"
  echo "load before: $(sysctl -n vm.loadavg)"
} > "$d/conditions.txt"
cd "$root"
npx vitest bench --run --config "$cfg" --maxWorkers=1 --reporter=default --reporter=json \
  "--outputFile.json=$d/vitest-bench.json" 2>&1 | tee "$d/bench.log"
{
  echo "load after: $(sysctl -n vm.loadavg)"
  echo "end: $(date -u +%FT%TZ)"
} >> "$d/conditions.txt"
