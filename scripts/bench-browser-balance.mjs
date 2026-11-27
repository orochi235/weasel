#!/usr/bin/env node
// The `browser` project alone in one process, its tabs dealt across Chromiums (`scripts/vitest-browser-spread.mjs`),
// at each CHROMIUMSxTABS given, alternated for REPS passes. Rows go to .bench/browser-balance/runs.jsonl; append
// them to scripts/bench-browser-project.runs.jsonl.
//
//   onto do --kind bench --task <name> --node teitou --solo --expect 15m --timeout 35m \
//     --out .bench/browser-balance -- node scripts/bench-browser-balance.mjs 6x3 9x2
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { cli } from './lib/help.mjs';

const { positionals: shapes } = cli(import.meta.url, {
  summary: 'Times the `browser` project alone in one process, its tabs dealt across Chromiums, at each CHROMIUMSxTABS shape given, alternated for REPS passes. Rows go to .bench/browser-balance/runs.jsonl.',
  positionals: '<chromiums>x<tabs>…',
  notes: 'Env: REPS=<n> passes over every shape (default 1).',
});
for (const shape of shapes) {
  if (!/^\d+x\d+$/.test(shape)) {
    console.error(`bench-browser-balance: a shape is CHROMIUMSxTABS, like 6x3, not ${shape}`);
    process.exit(2);
  }
}

const node = hostname().split('.')[0];
const out = '.bench/browser-balance';
const reps = Number(process.env.REPS || 1);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const dirs = [];
for (let r = 1; r <= reps; r++) {
  for (const shape of shapes) {
    const [chromiums, tabs] = shape.split('x');
    const dir = `${out}/r${r}-${shape}`;
    execFileSync(process.execPath, ['scripts/bench-browser-project.mjs', '--node', node, '--variants', 'bundled', '--processes', chromiums,
      '--tabs', tabs, '--split', 'spread', '--label', `spread-${shape}-r${r}`, '--out', dir], { stdio: 'inherit' });
    dirs.push(dir);
  }
}
writeFileSync(`${out}/runs.jsonl`, dirs.map((dir) => readFileSync(`${dir}/runs.jsonl`, 'utf8')).join(''));
