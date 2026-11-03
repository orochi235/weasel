#!/usr/bin/env bash
# Runs probe-rolldown-rebuilds in a Linux container (node:26-bookworm): rolldown 1.2.16 x300, esbuild x100,
# rolldown 1.2.11 x150, each with mimalloc's exit stats. Needs Docker; send it to a node that has it:
#   onto do --kind bench --node studio --task <name> --expect 15m --about <text> \
#     --out node_modules/.probe-rr-linux -- bash scripts/probe-rolldown-rebuilds-linux.sh
set -eu
desktop="$HOME/.docker/run/docker.sock"
if [ -z "${DOCKER_HOST:-}" ] && [ ! -S /var/run/docker.sock ] && [ -S "$desktop" ]; then export DOCKER_HOST="unix://$desktop"; fi
R=node_modules/.probe-rr-linux
rm -rf "$R"; mkdir -p "$R"
inside='set -eu
mkdir -p /w/scripts/lib && cd /w && tar -x
for v in 1.2.16 1.2.11; do mkdir -p v/$v && echo "{}" > v/$v/package.json && (cd v/$v && npm i --silent --no-audit --no-fund rolldown@$v >/dev/null); done
(cd v/1.2.16 && npm i --silent --no-audit --no-fund esbuild@0.27.7 >/dev/null)
run() { name=$1; shift; MIMALLOC_SHOW_STATS=1 node --expose-gc scripts/probe-rolldown-rebuilds.mjs --label "$name" --out /tmp/o/$name "$@" 2> >(tee /out/$name.stderr.txt >&2); cp /tmp/o/$name/runs.jsonl /out/$name.jsonl; }
run linux-rolldown-1.2.16 --iters 300 --from v/1.2.16
run linux-esbuild --bundler esbuild --iters 100 --from v/1.2.16
run linux-rolldown-1.2.11 --iters 150 --from v/1.2.11'
tar -c scripts/probe-rolldown-rebuilds.mjs scripts/lib/vmmap-regions.mjs | docker run --rm -i -h "$(hostname -s)-docker" -v "$PWD/$R:/out" node:26-bookworm bash -c "$inside"
