#!/bin/bash
# Mutation-test one package to measure which tests kill no mutant another test doesn't.
# Stryker is installed beside the tree's node_modules (gitignored) and removed on exit.
set -uo pipefail
cd "$(dirname "$0")/../.."
export MEASURE_PKG="${MEASURE_PKG:-geom}"
export MEASURE_OUT="${MEASURE_OUT:-measure/out/$MEASURE_PKG}"
TOOLS=node_modules/.stryker-tools
cleanup() { rm -rf "$TOOLS" node_modules/.stryker-tmp .stryker-tmp; git checkout -- "packages/$MEASURE_PKG/src" 2>/dev/null; }
trap cleanup EXIT

echo "installing stryker into $TOOLS"
mkdir -p "$TOOLS" "$MEASURE_OUT"
echo '{"private":true}' > "$TOOLS/package.json"
npm install --prefix "$TOOLS" --no-audit --no-fund --legacy-peer-deps --loglevel=error \
  @stryker-mutator/core@10.1.1 @stryker-mutator/vitest-runner@10.1.1 || exit 2

start=$(date +%s)
node "$TOOLS/node_modules/@stryker-mutator/core/bin/stryker.js" run measure/stryker/stryker.config.mjs 2>&1 \
  | tee "$MEASURE_OUT/stryker.log" \
  | perl -ne '$|=1; print; print "onto: progress $1/$2\n" if m{(\d+)/(\d+) tested}'
status=${PIPESTATUS[0]}
echo "stryker exit $status after $(( $(date +%s) - start ))s"
exit "$status"
