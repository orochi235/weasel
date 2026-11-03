#!/usr/bin/env bash
# Times the scene round trip and setPose (../scene-roundtrip-2026-10-29/roundtrip.mjs) at each
# <label>:<sha|tree> given, 9 interleaved rounds, through ../core-regress-2026-10-30/run.sh, writing
# <pass>/<node>/runs.jsonl here. Digest with pairs.mjs or ../core-regress-2026-10-30/digest.mjs.
# `run.sh costs <pass>` instead runs costs.mjs against the synced tree 9 times, into <pass>/<node>/costs.jsonl.
# Run from the repo root:
#   onto do --kind bench --solo --node msb-uai --expect 3m --task scene-roundtrip-<pass> --about '…' \
#     --out tests/perf/recorded/scene-roundtrip-2026-11-03/<pass> -- \
#     bash tests/perf/recorded/scene-roundtrip-2026-11-03/run.sh <pass> pre599:43a827165 now:tree
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
rounds="${ROUNDS:-9}"
if [ "$1" = costs ]; then
  out="$here/$2/$(hostname -s)"
  mkdir -p "$out"
  { echo "start: $(date -u +%FT%TZ)"; echo "synced tree: $(git rev-parse HEAD) dirty-paths: $(git status --porcelain | wc -l | tr -d ' ')"
    echo "cpu: $(sysctl -n machdep.cpu.brand_string)"; echo "node: $(node -v)"; } > "$out/conditions.txt"
  for r in $(seq 1 "$rounds"); do
    load="$(sysctl -n vm.loadavg)"
    rec="$(LABEL=now node --no-warnings --import ./tests/perf/bench/node-hooks.mjs "$here/costs.mjs")"
    printf '{"round":%d,"load":"%s","at":"%s","result":%s}\n' "$r" "$load" "$(date -u +%FT%TZ)" "$rec" >> "$out/costs.jsonl"
    echo "$r/$rounds $rec"; echo "onto: progress $r/$rounds" >&2
  done
  echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
  exit 0
fi
OUT="$here" ONLY=roundtrip ROUNDS="$rounds" exec bash "$here/../core-regress-2026-10-30/run.sh" "$@"
