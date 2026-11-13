#!/usr/bin/env node
// Reads cov.sh's per-test-file istanbul reports and finds test files that cover no statement or
// branch outcome some other file doesn't. Writes one JSONL record per test file beside the reports.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: cov-analyze.mjs <measure/out/<pkg>/cov>');
const root = process.argv[3] ?? '';

const files = [];
const owners = new Map();
for (const entry of readdirSync(dir)) {
  const report = join(dir, entry, 'coverage-final.json');
  const keyFile = join(dir, entry, 'keys.txt');
  if (!existsSync(report) && !existsSync(keyFile)) continue;
  const file = readFileSync(join(dir, entry, 'file.txt'), 'utf8').trim();
  const keys = new Set();
  if (existsSync(keyFile)) for (const k of readFileSync(keyFile, 'utf8').split('\n')) k && keys.add(k);
  else for (const [src, c] of Object.entries(JSON.parse(readFileSync(report, 'utf8')))) {
    const s = root ? relative(root, src) : src;
    for (const [id, n] of Object.entries(c.s)) if (n > 0) keys.add(`${s}:s${id}`);
    for (const [id, arms] of Object.entries(c.b)) arms.forEach((n, k) => n > 0 && keys.add(`${s}:b${id}.${k}`));
  }
  files.push({ file, keys });
  for (const k of keys) (owners.get(k) ?? owners.set(k, []).get(k)).push(file);
}

for (const f of files) f.unique = [...f.keys].filter((k) => owners.get(k).length === 1).length;

// Greedy set cover over test files: the fewest that keep every covered statement and branch arm.
const remaining = new Set(owners.keys());
const pool = new Map(files.map((f) => [f.file, f.keys]));
const cover = [];
while (remaining.size) {
  let best = null;
  let gain = 0;
  for (const [file, keys] of pool) {
    let g = 0;
    for (const k of keys) if (remaining.has(k)) g++;
    if (g > gain) [best, gain] = [file, g];
  }
  if (!best) break;
  cover.push(best);
  for (const k of pool.get(best)) remaining.delete(k);
  pool.delete(best);
}

writeFileSync(
  join(dir, '..', 'cov-files.jsonl'),
  files.map((f) => JSON.stringify({ file: f.file, covered: f.keys.size, unique: f.unique, inCover: cover.includes(f.file) })).join('\n') + '\n',
);

const n = files.length;
const pct = (k) => ((100 * k) / n).toFixed(1).padStart(5);
const w = String(n).length;
const row = (label, k) => console.log(`  ${label.padEnd(30)} ${String(k).padStart(w)}  ${pct(k)}%`);
console.log(`test files with coverage (${n}); statements and branch arms covered: ${owners.size}`);
row('no unique statement or arm', files.filter((f) => f.unique === 0).length);
row('1–5 unique', files.filter((f) => f.unique > 0 && f.unique <= 5).length);
row('more than 5 unique', files.filter((f) => f.unique > 5).length);
row('minimal covering set', cover.length);
