#!/usr/bin/env node
// Replaces one run's coverage-final.json (several MiB for core) with keys.txt: the statements and
// branch arms it covered, one per line, relative to the repo root.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const [dir, root] = process.argv.slice(2);
const report = join(dir, 'coverage-final.json');
if (!existsSync(report)) process.exit(0);
const keys = [];
for (const [src, c] of Object.entries(JSON.parse(readFileSync(report, 'utf8')))) {
  const s = relative(root, src);
  for (const [id, n] of Object.entries(c.s)) if (n > 0) keys.push(`${s}:s${id}`);
  for (const [id, arms] of Object.entries(c.b)) arms.forEach((n, k) => n > 0 && keys.push(`${s}:b${id}.${k}`));
}
writeFileSync(join(dir, 'keys.txt'), keys.join('\n') + '\n');
rmSync(report);
