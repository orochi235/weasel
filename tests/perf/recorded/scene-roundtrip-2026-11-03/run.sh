#!/usr/bin/env bash
# Times the scene round trip and setPose (../scene-roundtrip-2026-10-29/roundtrip.mjs) at each
# <label>:<sha|tree> given, 9 interleaved rounds, through ../core-regress-2026-10-30/run.sh, writing
# <pass>/<node>/runs.jsonl here. Digest with ../core-regress-2026-10-30/digest.mjs. Run from the repo root:
#   onto do --kind bench --solo --node msb-uai --expect 3m --task scene-roundtrip-<pass> \
#     --out tests/perf/recorded/scene-roundtrip-2026-11-03/<pass> -- \
#     bash tests/perf/recorded/scene-roundtrip-2026-11-03/run.sh <pass> pre599:43a827165 tree:tree
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
OUT="$here" ONLY=roundtrip ROUNDS="${ROUNDS:-9}" exec bash "$here/../core-regress-2026-10-30/run.sh" "$@"
