#!/bin/bash
# Per-test-file coverage for one package: each file runs alone, so the analysis can find files whose
# statements and branches are all covered by other files. The coverage provider is installed beside
# the tree's node_modules (gitignored) and removed on exit.
set -uo pipefail
cd "$(dirname "$0")/../.."
export MEASURE_PKG="${MEASURE_PKG:-geom}"
TOOLS=node_modules/.stryker-tools
OUT="measure/out/$MEASURE_PKG/cov"
# Workers import the provider by package name, so it is linked into node_modules for the run.
LINK=node_modules/@vitest/coverage-v8
[ -e "$LINK" ] && { echo "$LINK already exists; not touching it"; exit 2; }
trap 'rm -f "$LINK"; rm -rf "$TOOLS"' EXIT

mkdir -p "$TOOLS" "$OUT"
echo '{"private":true}' > "$TOOLS/package.json"
npm install --prefix "$TOOLS" --no-audit --no-fund --legacy-peer-deps --loglevel=error @vitest/coverage-v8@5.1.0 || exit 2
ln -s "$PWD/$TOOLS/node_modules/@vitest/coverage-v8" "$LINK"

git ls-files "packages/$MEASURE_PKG" | grep -E '\.test\.tsx?$' | grep -vE '\.(browser|build)\.test\.' > "$OUT/files.txt"
total=$(wc -l < "$OUT/files.txt" | tr -d ' ')
export OUT total
nl -ba "$OUT/files.txt" | xargs -P "${MEASURE_JOBS:-8}" -L1 bash -c '
  i=$0; f=$1; d="$OUT/$i"
  npx vitest run -c measure/stryker/vitest.config.ts "$f" --reporter=dot --coverage.enabled \
    --coverage.provider=v8 --coverage.reporter=json \
    --coverage.reportsDirectory="$d" --coverage.include="packages/$MEASURE_PKG/src/**/*.{ts,tsx}" \
    --coverage.exclude="**/*.test.ts" > "$d.log" 2>&1
  rc=$?
  mkdir -p "$d"; echo "$f" > "$d/file.txt"
  echo "$i/$total exit=$rc $f"'
