#!/usr/bin/env bash
# Loads the audits page as built into each directory under <pages dir> (e.g. before/ and after/), in headed Chrome on ANGLE Metal,
# warm and with cold shaders (`probe.mjs --cold`), into ./<host>/pages-<side>-<warmth>.{json,log}, with the
# machine's conditions and its Chrome Metal caches before and after. Run from the repo root as
#   bash tests/perf/recorded/first-frame-2026-11-21/pages.sh <pages dir> [label prefix]
# HEADLESS=1 runs it without a window, for checking the script on a fleet node.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
pages="$(cd "$1" && pwd)"
out="$here/$(hostname -s)"; prefix="${2:-pages}"
mkdir -p "$out"
headed=--headed; [ -n "${HEADLESS:-}" ] && headed=
caches() {
  local c; c="$(getconf DARWIN_USER_CACHE_DIR)"
  for d in "$c"/com.google.Chrome*/com.apple.metal "$c"/com.google.Chrome*/com.apple.metalfe; do
    [ -d "$d" ] && echo "  $(du -sk "$d" | cut -f1) KiB, $(find "$d" -type f | wc -l | tr -d ' ') files, newest $(ls -t "$d" | head -1)  $d"
  done
  return 0
}
{
  echo "pages: start $(date -u +%FT%TZ) tree $(git rev-parse HEAD) headed '${headed}'"
  echo "pages: $(sysctl -n machdep.cpu.brand_string) ($(sysctl -n hw.ncpu) threads), node $(node -v), load $(sysctl -n vm.loadavg)"
  echo "pages: Chrome Metal caches before:"; caches
} >> "$out/conditions.txt"
for side in $(cd "$pages" && ls -d */ | tr -d /); do
  for warmth in warm cold; do
    cold=; [ "$warmth" = cold ] && cold=--cold
    echo "== $side $warmth"
    node "$here/probe.mjs" "$pages/$side" /skulkr/ --rounds "${ROUNDS:-2}" --channel chrome $headed $cold \
      --out "$out/$prefix-$side-$warmth.json" 2>&1 | tee "$out/$prefix-$side-$warmth.log" | grep -E 'longest task|page errors'
  done
done
{
  echo "pages: Chrome Metal caches after:"; caches
  echo "pages: load $(sysctl -n vm.loadavg); end $(date -u +%FT%TZ)"
} >> "$out/conditions.txt"
