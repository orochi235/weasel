#!/usr/bin/env bash
# Times walk.bench.ts across commits, one after another on one node, in a checkout outside the
# synced tree. Each run appends one record to <out>/runs.jsonl and keeps vitest's JSON and log.
#
#   run.sh <out-name> measure <sha>...                 each sha under both harnesses
#   run.sh <out-name> bisect <good> <bad> <harness>    first-parent bisect, then into the culprit merge
#   run.sh <out-name> tree [harness...]                the synced tree as it stands (uncommitted work included)
#   run.sh <out-name> compare <sha> <rounds>           the sha and the synced tree, alternating, native
#
# Harnesses: `runner` is the commit's own bench config (Vite's module runner until 01cd22861);
# `native` copies the synced tree's config and node-hooks.mjs in, so every commit loads natively.
# Run from the repo root as
#   onto do --kind bench --solo --node <node> --out tests/perf/recorded/pick-index-2026-10-22/across-commits -- \
#     bash tests/perf/recorded/pick-index-2026-10-22/across-commits/run.sh <out-name> ...
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
out="$here/$1"; shift
mode="$1"; shift
tree="${TMPDIR:-/tmp}/weasel-areawalk-$$"
mkdir -p "$out"
cleanup() {
  git -C "$root" worktree remove --force "$tree" 2>/dev/null || rm -rf "$tree"
  git -C "$root" worktree prune
  rm -f "$root/tests/perf/bench/walk.bench.ts" "$tree.count"
}
trap cleanup EXIT
log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$out/conditions.txt" >&2; }

log "start mode=$mode args=$* host=$(hostname -s)"
log "synced tree: $(git -C "$root" rev-parse HEAD) dirty-paths: $(git -C "$root" status --porcelain | wc -l | tr -d ' ')"
log "cpu: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads) node: $(node -v)"

installed_lock=""
checkout() { # <sha>
  local sha="$1"
  git -C "$root" cat-file -e "$sha^{commit}" 2>/dev/null || git -C "$root" fetch --quiet origin
  if [ ! -d "$tree" ]; then git -C "$root" worktree add --detach --force "$tree" "$sha" >/dev/null 2>&1; fi
  git -C "$tree" checkout --quiet --force --detach "$sha"
  git -C "$tree" clean -fdq
  local lock; lock="$(git -C "$tree" rev-parse "$sha:package-lock.json")"
  if [ "$lock" != "$installed_lock" ]; then
    log "npm ci at $sha (lock $lock)"
    (cd "$tree" && npm ci --ignore-scripts --no-audit --no-fund) > "$out/npm-ci-$sha.log" 2>&1
    installed_lock="$lock"
  fi
}

# Prints the hitTestArea median in ms, or nothing when the run failed.
bench() { # <dir> <label> <harness>
  local dir="$1" label="$2" harness="$3"
  cp "$here/walk.bench.ts" "$dir/tests/perf/bench/walk.bench.ts"
  if [ "$harness" = native ] && [ "$dir" != "$root" ]; then
    cp "$root/tests/perf/vitest.bench.config.ts" "$dir/tests/perf/vitest.bench.config.ts"
    # Before 2026-10-12 `weaselAliases` returned string `find`s, which Vite matches as a prefix.
    sed 's#if (find.test(specifier))#if (typeof find === "string" ? specifier === find || specifier.startsWith(find + "/") : find.test(specifier))#' \
      "$root/tests/perf/bench/node-hooks.mjs" > "$dir/tests/perf/bench/node-hooks.mjs"
  fi
  local base="$out/$label-$harness" before after ok=1
  before="$(sysctl -n vm.loadavg)"
  (cd "$dir" && npx vitest bench --run --config tests/perf/vitest.bench.config.ts \
    --reporter=default --reporter=json --outputFile.json="$base.json" \
    tests/perf/bench/walk.bench.ts) > "$base.log" 2>&1 || ok=0
  after="$(sysctl -n vm.loadavg)"
  local sha; sha="$(git -C "$dir" rev-parse HEAD)"
  local dirty; dirty="$(git -C "$dir" status --porcelain -- ':!tests/perf/bench/walk.bench.ts' ':!tests/perf/vitest.bench.config.ts' ':!tests/perf/bench/node-hooks.mjs' ':!tests/perf/recorded' | wc -l | tr -d ' ')"
  node -e '
    const [file, label, harness, sha, dirty, ok, before, after, host] = process.argv.slice(1);
    const fs = require("fs");
    let tasks = [];
    try {
      const r = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const t of r.testResults) for (const a of t.assertionResults)
        for (const b of a.benchmarks ?? []) for (const k of b.tasks) tasks.push({ name: k.name, ...k.latency });
    } catch {}
    const pick = (t) => ({ name: t.name, p50: t.p50, mean: t.mean, min: t.min, max: t.max, p75: t.p75, p99: t.p99, rme: t.rme, samples: t.samplesCount });
    const rec = { time: new Date().toISOString(), host, label, harness, sha, dirtyPaths: +dirty, ok: ok === "1" && tasks.length > 0,
      loadBefore: before, loadAfter: after, unit: "ms", tasks: tasks.map(pick) };
    fs.appendFileSync(process.argv[10], JSON.stringify(rec) + "\n");
    const area = tasks.find((t) => t.name === "hitTestArea");
    if (rec.ok && area) process.stdout.write(String(area.p50));
  ' "$base.json" "$label" "$harness" "$sha" "$dirty" "$ok" "$before" "$after" "$(hostname -s)" "$out/runs.jsonl"
}

counter="$tree.count" total_runs=1   # a file: point runs in a subshell under bisect
echo 0 > "$counter"
point() { # <sha> <harness> -> median
  local n=$(( $(cat "$counter") + 1 )); echo "$n" > "$counter"
  echo "onto: progress $(( n - 1 ))/$(( n > total_runs ? n : total_runs ))" >&2
  checkout "$1"
  local m; m="$(bench "$tree" "$(git -C "$tree" rev-parse --short=9 "$1")" "$2")"
  log "  $(git -C "$tree" log -1 --format='%h %ad %s' --date=short "$1" | cut -c1-90) [$2]: ${m:-FAILED} ms"
  echo "$m"
}

case "$mode" in
  measure)
    total_runs=$(( $# * 2 ))
    for sha in "$@"; do for h in runner native; do point "$sha" "$h" >/dev/null; done; done ;;
  tree)
    harnesses=("$@"); [ ${#harnesses[@]} -gt 0 ] || harnesses=(native)
    for h in "${harnesses[@]}"; do
      m="$(bench "$root" "tree-$(git -C "$root" rev-parse --short=9 HEAD)" "$h")"
      log "  synced tree [$h]: ${m:-FAILED} ms"
    done ;;
  compare) # <sha> <rounds>: the commit and the synced tree, alternating, under native imports
    total_runs="$2"
    for i in $(seq 1 "$2"); do
      point "$1" native >/dev/null
      m="$(bench "$root" "tree-$(git -C "$root" rev-parse --short=9 HEAD)-r$i" native)"
      log "  synced tree [native] round $i: ${m:-FAILED} ms"
    done ;;
  bisect)
    good="$1" bad="$2" harness="$3"
    total_runs=18   # endpoints, ~11 first-parent steps, a few inside a merge
    fast="$(point "$good" "$harness")" slow="$(point "$bad" "$harness")"
    cut="$(node -e "console.log(Math.sqrt($fast * $slow).toFixed(3))")"
    log "bisect $good ($fast ms) .. $bad ($slow ms) [$harness], slow above $cut ms"
    is_slow() { node -e "process.exit(+process.argv[1] > +process.argv[2] ? 0 : 1)" "$1" "$cut"; }
    # Bisects the first-parent chain good..bad; prints the first slow commit.
    search() { # <good> <bad>
      local list; list=($(git -C "$root" rev-list --first-parent --reverse "$1..$2"))
      local lo=-1 hi=$(( ${#list[@]} - 1 ))   # list[lo] fast (lo=-1 is good), list[hi] slow
      log "  ${#list[@]} first-parent commits in $1..$2"
      while [ $(( hi - lo )) -gt 1 ]; do
        local mid=$(( (lo + hi) / 2 )) m=""
        while [ -z "$m" ] && [ "$mid" -lt "$hi" ]; do
          m="$(point "${list[$mid]}" "$harness")"; [ -n "$m" ] || mid=$(( mid + 1 ))
        done
        if [ -z "$m" ]; then hi=$mid; break; fi
        if is_slow "$m"; then hi=$mid; else lo=$mid; fi
      done
      echo "${list[$hi]}"
    }
    culprit="$(search "$good" "$bad")"
    while git -C "$root" rev-parse --verify --quiet "$culprit^2" >/dev/null; do
      log "first slow first-parent commit $culprit is a merge; descending into its second parent"
      culprit="$(search "$culprit^1" "$culprit^2")"
    done
    log "culprit: $(git -C "$root" log -1 --format='%H %ad %s' --date=short "$culprit")" ;;
  *) echo "unknown mode $mode" >&2; exit 2 ;;
esac
log "end"
