#!/usr/bin/env bash
# Times the unindexed area walk (../core-regress-2026-10-30/walk.mjs, the `full walk` row of
# walk.bench.ts) at each <label>:<sha> given, and at the synced tree as `<label>:tree`, ROUNDS
# times, one fresh process per run, on one node. Odd rounds go in the order given, even rounds
# reversed (ABBA). With PROFILE=1 each first-round run also writes a V8 CPU profile.
# Run from the repo root as
#   onto do --kind bench --solo --task area-walk-<pass> --expect 5m --node msb-uai --env NODE_NAME=msb-uai \
#     --out tests/perf/recorded/area-walk-2026-11-03/<pass> -- \
#     bash tests/perf/recorded/area-walk-2026-11-03/run.sh <pass> <label>:<sha|tree> ...
# Each run appends one JSON record to <pass>/<node>/runs.jsonl; digest with
#   node tests/perf/recorded/core-regress-2026-10-30/digest.mjs <pass>/<node>/runs.jsonl
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
prev="$here/../core-regress-2026-10-30"
root="$(git rev-parse --show-toplevel)"
pass="$1"; shift
out="$here/$pass/${NODE_NAME:-$(hostname -s)}"
trees="$root/.bench-trees"
rounds="${ROUNDS:-8}"
mkdir -p "$out" "$trees"
cleanup() {
  for t in "$trees"/*; do [ -d "$t" ] && git -C "$root" worktree remove --force "$t" || true; done
  rm -rf "$trees"
}
trap cleanup EXIT

{
  echo "start: $(date -u +%FT%TZ)"
  echo "synced tree: $(git -C "$root" rev-parse HEAD) dirty-paths: $(git -C "$root" status --porcelain | wc -l | tr -d ' ')"
  echo "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads, $(( $(sysctl -n hw.memsize) / 1073741824 )) GB)"
  echo "node: $(node -v)"
  echo "rounds: $rounds batches: ${BATCHES:-200} profile: ${PROFILE:-0} order: ABBA"
  echo "labels: $*"
} > "$out/conditions.txt"

dir_of() { if [ "$1" = tree ]; then echo "$root"; else echo "$trees/$1"; fi; }
for pair in "$@"; do
  sha="${pair##*:}"
  [ "$sha" = tree ] && continue
  git -C "$root" cat-file -e "$sha^{commit}" 2>/dev/null || git -C "$root" fetch --quiet origin
  git -C "$root" worktree add --detach --force "$trees/$sha" "$sha" > /dev/null
  mkdir -p "$trees/$sha/tests/perf/recorded/core-regress-2026-10-30"
  cp "$prev/walk.mjs" "$trees/$sha/tests/perf/recorded/core-regress-2026-10-30/"
  # Older commits' weaselAliases() also emit string `find`s, which the current hooks don't take.
  sed 's|if (find.test(specifier)) return specifier.replace(find, replacement);|if (typeof find === "string" ? specifier === find : find.test(specifier)) return typeof find === "string" ? replacement : specifier.replace(find, replacement);|' \
    "$root/tests/perf/bench/node-hooks.mjs" > "$trees/$sha/tests/perf/bench/node-hooks.mjs"
done

n=$(( rounds * $# )); i=0
for r in $(seq 1 "$rounds"); do
  pairs=("$@")
  if (( r % 2 == 0 )); then pairs=(); for (( k=$#; k>=1; k-- )); do pairs+=("${!k}"); done; fi
  for pair in "${pairs[@]}"; do
    label="${pair%%:*}" sha="${pair##*:}" dir="$(dir_of "${pair##*:}")"
    i=$(( i + 1 ))
    prof=()
    if [ "${PROFILE:-0}" = 1 ] && [ "$r" = 1 ]; then
      prof=(--cpu-prof --cpu-prof-dir "$out/prof" --cpu-prof-name "$label-walk.cpuprofile")
    fi
    load="$(sysctl -n vm.loadavg)"
    rec="$(cd "$dir" && LABEL="$label" node --no-warnings ${prof[@]+"${prof[@]}"} --import ./tests/perf/bench/node-hooks.mjs ./tests/perf/recorded/core-regress-2026-10-30/walk.mjs)"
    printf '{"round":%d,"sha":"%s","script":"walk.mjs","load":"%s","at":"%s","result":%s}\n' \
      "$r" "$sha" "$load" "$(date -u +%FT%TZ)" "$rec" >> "$out/runs.jsonl"
    echo "$i/$n $label r$r $rec"; echo "onto: progress $i/$n" >&2
  done
done
if [ -d "$out/prof" ]; then
  for f in "$out/prof"/*.cpuprofile; do node "$prev/profile.mjs" "$f" > "${f%.cpuprofile}.top.txt"; gzip -f "$f"; done
fi
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
