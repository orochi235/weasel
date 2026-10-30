#!/usr/bin/env bash
# Times walk.mjs and ../scene-roundtrip-2026-10-29/roundtrip.mjs at each <label>:<sha> given, and at
# the synced tree as `<label>:tree`, ROUNDS times, interleaved, one fresh process per run, on one
# node. With PROFILE=1 each first-round run also writes a V8 CPU profile, digested by profile.mjs.
# Run from the repo root as
#   onto do --kind bench --solo --expect 15m --out tests/perf/recorded/core-regress-2026-10-30/<pass> -- \
#     bash tests/perf/recorded/core-regress-2026-10-30/run.sh <pass> <label>:<sha|tree> ...
# Each run appends one JSON record to <pass>/<node>/runs.jsonl.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
pass="$1"; shift
out="$here/$pass/$(hostname -s)"
trees="$root/.bench-trees"
rounds="${ROUNDS:-5}"
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
  echo "rounds: $rounds batches: ${BATCHES:-200} profile: ${PROFILE:-0}"
} > "$out/conditions.txt"

dir_of() { if [ "$1" = tree ]; then echo "$root"; else echo "$trees/$1"; fi; }
for pair in "$@"; do
  sha="${pair##*:}"
  [ "$sha" = tree ] && continue
  git -C "$root" cat-file -e "$sha^{commit}" 2>/dev/null || git -C "$root" fetch --quiet origin
  git -C "$root" worktree add --detach --force "$trees/$sha" "$sha" > /dev/null
  mkdir -p "$trees/$sha/tests/perf/recorded/core-regress-2026-10-30"
  cp "$here/walk.mjs" "$trees/$sha/tests/perf/recorded/core-regress-2026-10-30/"
  cp "$root/tests/perf/bench/node-hooks.mjs" "$trees/$sha/tests/perf/bench/node-hooks.mjs"
done

n=$(( rounds * $# * 2 )); i=0
for r in $(seq 1 "$rounds"); do
  for pair in "$@"; do
    label="${pair%%:*}" sha="${pair##*:}" dir="$(dir_of "${pair##*:}")"
    for script in "$dir/tests/perf/recorded/core-regress-2026-10-30/walk.mjs" "$here/../scene-roundtrip-2026-10-29/roundtrip.mjs"; do
      i=$(( i + 1 ))
      prof=()
      if [ "${PROFILE:-0}" = 1 ] && [ "$r" = 1 ]; then
        prof=(--cpu-prof --cpu-prof-dir "$out/prof" --cpu-prof-name "$label-$(basename "$script" .mjs).cpuprofile")
      fi
      load="$(sysctl -n vm.loadavg)"
      rec="$(cd "$dir" && LABEL="$label" node --no-warnings ${prof[@]+"${prof[@]}"} --import ./tests/perf/bench/node-hooks.mjs "$script")"
      printf '{"round":%d,"sha":"%s","script":"%s","load":"%s","at":"%s","result":%s}\n' \
        "$r" "$sha" "$(basename "$script")" "$load" "$(date -u +%FT%TZ)" "$rec" >> "$out/runs.jsonl"
      echo "$i/$n $label r$r $rec"
    done
  done
done
if [ -d "$out/prof" ]; then
  for f in "$out/prof"/*.cpuprofile; do node "$here/profile.mjs" "$f" > "${f%.cpuprofile}.top.txt"; gzip -f "$f"; done
fi
echo "end: $(date -u +%FT%TZ)" >> "$out/conditions.txt"
