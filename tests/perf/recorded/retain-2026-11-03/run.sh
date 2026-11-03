#!/usr/bin/env bash
# Runs one labeled perf spec into ./<node>/<label>.{json,log}, with the node's conditions. Run from
# the repo root as
#   onto do --kind bench --solo --gui --node teitou --task retain-<x> --expect <t> \
#     --out tests/perf/recorded/retain-2026-11-03 -- \
#     bash tests/perf/recorded/retain-2026-11-03/run.sh <label> <spec> [VAR=value ...]
# e.g. run.sh redraw-1 retain-redraw WEASEL_PERF_CONTEXTS=8. Set NO_CI=1 to skip `npm ci`.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
label="$1"; spec="$2"; shift 2
out="$here/$(hostname -s)"
mkdir -p "$out/$label"
cd "$root"
[ -n "${NO_CI:-}" ] || npm ci --no-audit --no-fund > /dev/null 2>&1
gpu() { ioreg -r -d 1 -c IOAccelerator | grep -o '"Device Utilization %"=[0-9]*' | head -1; }
{
  echo "$label: start $(date -u +%FT%TZ) $spec $*"
  echo "$label: tree $(git rev-parse HEAD) dirty-paths $(git status --porcelain | wc -l | tr -d ' ')"
  echo "$label: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads), node $(node -v)"
  echo "$label: load before $(sysctl -n vm.loadavg) $(gpu)"
} >> "$out/conditions.txt"
env "$@" WEASEL_PERF_OUT="$out/$label" WEASEL_PERF_PORT=33571 \
  npm run test:perf -- "perf/$spec.spec.ts" 2>&1 | tee "$out/$label.log"
echo "$label: load after $(sysctl -n vm.loadavg) $(gpu); end $(date -u +%FT%TZ)" >> "$out/conditions.txt"
