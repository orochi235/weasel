#!/usr/bin/env bash
# Times roundtrip.mjs at each <label>:<sha> given, ROUNDS times, interleaved (every commit once
# per round), one fresh process per run, on one node. Run from the repo root as
#   onto do --kind bench --solo --expect 15m --out tests/perf/recorded/scene-roundtrip-2026-10-29/<pass> -- \
#     bash tests/perf/recorded/scene-roundtrip-2026-10-29/run.sh <pass> <label>:<sha> ...
# Each run appends one JSON record to <pass>/<node>/runs.jsonl. Every commit, the synced tree's
# included, is timed from its own detached checkout under .bench-trees/, removed on exit; all of
# them resolve third-party packages from the synced tree's node_modules.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
pass="$1"; shift
out="$here/$pass/$(hostname -s)"
trees="$root/.bench-trees"
rounds="${ROUNDS:-5}"
mkdir -p "$out" "$trees"
hooks="$(mktemp)"
# Older commits' weaselAliases() also emit string `find`s, which the current hooks don't take.
sed 's|if (find.test(specifier)) return specifier.replace(find, replacement);|if (typeof find === "string" ? specifier === find : find.test(specifier)) return typeof find === "string" ? replacement : specifier.replace(find, replacement);|' \
  "$root/tests/perf/bench/node-hooks.mjs" > "$hooks"
grep -q 'typeof find === "string"' "$hooks"
cleanup() {
  for t in "$trees"/*; do [ -d "$t" ] && git -C "$root" worktree remove --force "$t" || true; done
  rm -rf "$trees" "$hooks"
}
trap cleanup EXIT

{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git -C "$root" rev-parse HEAD) dirty-paths: $(git -C "$root" status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads, $(( $(sysctl -n hw.memsize) / 1073741824 )) GB)"
  echo "node: $(node -v)"
  echo "rounds: $rounds batches: ${BATCHES:-200}"
} > "$out/conditions.txt"

for pair in "$@"; do
  sha="${pair##*:}"
  git -C "$root" cat-file -e "$sha^{commit}" 2>/dev/null || git -C "$root" fetch --quiet origin
  git -C "$root" worktree add --detach --force "$trees/$sha" "$sha" > /dev/null
  cp "$hooks" "$trees/$sha/tests/perf/bench/node-hooks.mjs"
done

n=$(( rounds * $# )); i=0
for r in $(seq 1 "$rounds"); do
  for pair in "$@"; do
    label="${pair%%:*}" sha="${pair##*:}"
    i=$(( i + 1 ))
    load="$(sysctl -n vm.loadavg)"
    rec="$(cd "$trees/$sha" && LABEL="$label" node --no-warnings --import ./tests/perf/bench/node-hooks.mjs \
      "$here/roundtrip.mjs")"
    printf '{"round":%d,"sha":"%s","load":"%s","at":"%s","result":%s}\n' \
      "$r" "$sha" "$load" "$(date -u +%FT%TZ)" "$rec" >> "$out/runs.jsonl"
    echo "$i/$n $label r$r $rec"
  done
done
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
