#!/usr/bin/env node
// Runs probe-rolldown-rebuilds in a Linux container (node:26-bookworm): rolldown 1.2.16 x300, esbuild x100,
// rolldown 1.2.11 x150, each with mimalloc's exit stats. Needs Docker; send it to a node that has it:
//   onto do --kind bench --node studio --task <name> --expect 15m --about <text> \
//     --out node_modules/.probe-rr-linux -- node scripts/probe-rolldown-rebuilds-linux.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join, resolve } from 'node:path';
import { cli } from './lib/help.mjs';

cli(import.meta.url, {
  summary: "Runs probe-rolldown-rebuilds in a node:26-bookworm container: rolldown 1.2.16 x300, esbuild x100, rolldown 1.2.11 x150, each with mimalloc's exit stats. Needs Docker. Results go to node_modules/.probe-rr-linux.",
});

const isSocket = (path) => existsSync(path) && statSync(path).isSocket();
const desktop = join(homedir(), '.docker/run/docker.sock');
const env = !process.env.DOCKER_HOST && !isSocket('/var/run/docker.sock') && isSocket(desktop)
  ? { ...process.env, DOCKER_HOST: `unix://${desktop}` }
  : process.env;
const R = 'node_modules/.probe-rr-linux';
rmSync(R, { recursive: true, force: true });
mkdirSync(R, { recursive: true });

const inside = `set -eu
mkdir -p /w/scripts/lib && cd /w && tar -x
for v in 1.2.16 1.2.11; do mkdir -p v/$v && echo "{}" > v/$v/package.json && (cd v/$v && npm i --silent --no-audit --no-fund rolldown@$v >/dev/null); done
(cd v/1.2.16 && npm i --silent --no-audit --no-fund esbuild@0.27.7 >/dev/null)
run() { name=$1; shift; MIMALLOC_SHOW_STATS=1 node --expose-gc scripts/probe-rolldown-rebuilds.mjs --label "$name" --out /tmp/o/$name "$@" 2> >(tee /out/$name.stderr.txt >&2); cp /tmp/o/$name/runs.jsonl /out/$name.jsonl; }
run linux-rolldown-1.2.16 --iters 300 --from v/1.2.16
run linux-esbuild --bundler esbuild --iters 100 --from v/1.2.16
run linux-rolldown-1.2.11 --iters 150 --from v/1.2.11`;

const tar = spawn('tar', ['-c', 'scripts/probe-rolldown-rebuilds.mjs', 'scripts/lib/vmmap-regions.mjs', 'scripts/lib/help.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
const run = spawn('docker', ['run', '--rm', '-i', '-h', `${hostname().split('.')[0]}-docker`, '-v', `${resolve(R)}:/out`, 'node:26-bookworm', 'bash', '-c', inside], {
  env,
  stdio: ['pipe', 'inherit', 'inherit'],
});
tar.stdout.pipe(run.stdin);
const [tarCode, runCode] = await Promise.all([tar, run].map((child) => new Promise((done) => child.on('close', (code) => done(code ?? 1)))));
process.exit(runCode || tarCode);
