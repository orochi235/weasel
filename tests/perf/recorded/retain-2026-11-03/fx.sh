#!/usr/bin/env bash
# The redraw by tile side once tiles cull at every depth, then layer-dispatch with and without a
# blur on each layer, through run.sh. Run from the repo root as
#   onto do --kind bench --solo --gui --node teitou --task retain-fx --expect 9m \
#     --out tests/perf/recorded/retain-2026-11-03 -- bash tests/perf/recorded/retain-2026-11-03/fx.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ladder=(WEASEL_PERF_LAYERS=1,4 WEASEL_PERF_CMDS=1,10,30,100,300)
echo "onto: plan 3"
bash "$here/run.sh" redraw-tiles retain-redraw WEASEL_PERF_TILES=none,512,1024,2048 WEASEL_PERF_CONTEXTS=4
echo "onto: progress 1/3"
NO_CI=1 bash "$here/run.sh" dispatch-plain layer-dispatch "${ladder[@]}"
echo "onto: progress 2/3"
NO_CI=1 bash "$here/run.sh" dispatch-blur8 layer-dispatch WEASEL_PERF_BLUR=8 "${ladder[@]}"
echo "onto: progress 3/3"
