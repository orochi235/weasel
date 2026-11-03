#!/usr/bin/env bash
# One spec in ABBA order on one node: "before" with FILES as at REF, "after" as synced, each through
# run.sh under <prefix>-before-N / <prefix>-after-N. Run from the repo root as
#   onto do --kind bench --solo --gui --node teitou --task retain-<x> --expect <t> \
#     --out tests/perf/recorded/retain-2026-11-03 -- \
#     env REF=HEAD FILES="packages/renderer/src/draw/retained.ts" \
#     bash tests/perf/recorded/retain-2026-11-03/ab.sh <prefix> <spec> [VAR=value ...]
# The files are swapped in place and restored on exit.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel)"
prefix="$1"; spec="$2"; shift 2
read -r -a files <<< "$FILES"
keep="$(mktemp -d)"
for f in "${files[@]}"; do mkdir -p "$keep/$(dirname "$f")"; cp "$root/$f" "$keep/$f"; done
synced() { for f in "${files[@]}"; do cp "$keep/$f" "$root/$f"; done; }
before() { for f in "${files[@]}"; do git -C "$root" show "$REF:$f" > "$root/$f"; done; }
trap 'synced; rm -rf "$keep"' EXIT
echo "onto: plan 4"
before; bash "$here/run.sh" "$prefix-before-1" "$spec" "$@"; echo "onto: progress 1/4"
synced; NO_CI=1 bash "$here/run.sh" "$prefix-after-1" "$spec" "$@"; echo "onto: progress 2/4"
synced; NO_CI=1 bash "$here/run.sh" "$prefix-after-2" "$spec" "$@"; echo "onto: progress 3/4"
before; NO_CI=1 bash "$here/run.sh" "$prefix-before-2" "$spec" "$@"; echo "onto: progress 4/4"
