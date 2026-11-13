#!/bin/bash
# One `onto run --each` item: mutation-test a single source file into its own output directory.
# An item whose report already exists is skipped, so a relaunch resumes where the last one stopped.
set -uo pipefail
cd "$(dirname "$0")/../.."
src=$1
export MEASURE_OUT="measure/out/${MEASURE_PKG:-geom}/mut/$(echo "${src#packages/}" | tr / _)"
[ -s "$MEASURE_OUT/mutation.json" ] && { echo "already done: $src"; exit 0; }
MEASURE_MUTATE="$src" exec bash measure/stryker/run.sh
