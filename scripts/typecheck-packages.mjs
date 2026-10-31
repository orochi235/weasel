#!/usr/bin/env node
/**
 * Typechecks each package alone, under its own tsconfig.json: the program an
 * editor shows for a file in that package, which `npm run typecheck` never
 * builds because it runs the root config.
 *
 *   npm run typecheck:packages                 # every package
 *   npm run typecheck:packages -- routing ui   # the ones named
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tscArgv } from './lib/tsc.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const named = process.argv.slice(2);
const packages = readdirSync(join(ROOT, 'packages'))
  .filter((name) => existsSync(join(ROOT, 'packages', name, 'tsconfig.json')))
  .filter((name) => named.length === 0 || named.includes(name))
  .sort();
const missing = named.filter((name) => !packages.includes(name));
if (missing.length > 0) {
  console.error(`no packages/<name>/tsconfig.json for: ${missing.join(', ')}`);
  process.exit(2);
}

const width = Math.max(...packages.map((name) => name.length));
const digits = String(packages.length).length;
const failed = [];
for (const [index, name] of packages.entries()) {
  const run = spawnSync(
    process.execPath,
    tscArgv(['-p', join('packages', name, 'tsconfig.json'), '--noEmit', '--incremental', 'false', '--pretty', 'false']),
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 },
  );
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}`;
  /** @type {Record<string, number>} */
  const codes = {};
  for (const [, code] of output.matchAll(/error (TS\d+)/g)) codes[code] = (codes[code] ?? 0) + 1;
  const tally = Object.entries(codes).map(([code, count]) => `${count} ${code}`).join(', ');
  const verdict = run.status === 0 ? 'ok' : `FAIL ${tally || `exit ${run.status}`}`;
  console.log(`${String(index + 1).padStart(digits)}/${packages.length} ${name.padEnd(width)} ${verdict}`);
  if (run.status !== 0) failed.push({ name, output });
}

for (const { name, output } of failed) console.log(`\n--- ${name}\n${output.trimEnd()}`);
if (failed.length > 0) {
  console.log(`\n${failed.length} of ${packages.length} failed: ${failed.map(({ name }) => name).join(', ')}`);
  process.exit(1);
}
