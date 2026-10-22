#!/usr/bin/env bash
# Times walk.bench.ts at 9db2cae5f (the 2026-09-29 baseline), at 394b86d43 (the branch base's
# code: 05d522c47 adds only docs on top of it and is not on origin), and at the synced tree, one
# after another on one node. Run from the repo root as
#   onto do --kind bench --solo --node keiei --out tests/perf/recorded/pick-index-2026-10-22/across-commits -- \
#     bash tests/perf/recorded/pick-index-2026-10-22/across-commits/run.sh
# Each commit's checkout lives under .bench-trees/ and is removed on exit; only the logs stay.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$(hostname -s)"
trees="$root/.bench-trees"
mkdir -p "$out" "$trees"
cleanup() {
  for t in "$trees"/*; do [ -d "$t" ] && git -C "$root" worktree remove --force "$t" || true; done
  rm -rf "$trees" "$root/tests/perf/bench/walk.bench.ts"
}
trap cleanup EXIT

{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git -C "$root" rev-parse HEAD) dirty-paths: $(git -C "$root" status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads, $(( $(sysctl -n hw.memsize) / 1073741824 )) GB)"
  echo "node: $(node -v)"
} > "$out/conditions.txt"

bench() { # <label> <tree>
  local label="$1" tree="$2"
  cp "$here/walk.bench.ts" "$tree/tests/perf/bench/walk.bench.ts"
  echo "$label: load before $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
  (cd "$tree" && npx vitest bench --run --config tests/perf/vitest.bench.config.ts \
    --reporter=default --reporter=json --outputFile.json="$out/$label.json" \
    tests/perf/bench/walk.bench.ts) 2>&1 | tee "$out/$label.log"
  echo "$label: load after $(sysctl -n vm.loadavg)" >> "$out/conditions.txt"
}

for pair in "2026-09-29-9db2cae5f:9db2cae5f" "base-394b86d43:394b86d43"; do
  label="${pair%%:*}" sha="${pair##*:}"
  git -C "$root" cat-file -e "$sha^{commit}" 2>/dev/null || git -C "$root" fetch --quiet origin
  git -C "$root" worktree add --detach --force "$trees/$sha" "$sha"
  # The base shares the synced tree's lockfile and resolves its node_modules from the parent.
  if ! git -C "$root" diff --quiet "$sha" -- package-lock.json; then
    echo "$label: npm ci" >> "$out/conditions.txt"
    (cd "$trees/$sha" && npm ci --ignore-scripts --no-audit --no-fund) > "$out/$label.npm-ci.log" 2>&1
  fi
  bench "$label" "$trees/$sha"
done
bench "branch-HEAD" "$root"
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
