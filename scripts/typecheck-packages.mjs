#!/usr/bin/env node
/**
 * Typechecks each package alone, under its own tsconfig.json: the program an
 * editor shows for a file in that package, which `npm run typecheck` never
 * builds because it runs the root config. A solution-style config (`"files": []`
 * beside `references`) is followed to the configs it references, and a program
 * with no root files fails rather than passing on nothing.
 *
 *   npm run typecheck:packages                 # every package
 *   npm run typecheck:packages -- routing ui   # the ones named
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tscArgv } from './lib/tsc.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const ts = require('typescript');
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

/**
 * The programs `configPath` stands for: its own when it has root files or no
 * references, then every config its references reach, depth first.
 * @param {string} configPath
 * @param {Set<string>} seen
 * @returns {{ config: string, files: number }[]}
 */
function programsOf(configPath, seen = new Set()) {
  if (seen.has(configPath)) return [];
  seen.add(configPath);
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => {},
  });
  const files = parsed?.fileNames.length ?? 0;
  const references = parsed?.projectReferences ?? [];
  const own = files > 0 || references.length === 0 ? [{ config: configPath, files }] : [];
  return [...own, ...references.flatMap((ref) => programsOf(ts.resolveProjectReferencePath(ref), seen))];
}

const programs = packages.flatMap((name) => {
  const pkgConfig = join(ROOT, 'packages', name, 'tsconfig.json');
  const found = programsOf(pkgConfig);
  return found.map(({ config, files }) => ({
    label: found.length === 1 && config === pkgConfig ? name : relative(join(ROOT, 'packages'), config),
    config,
    files,
  }));
});

/** @param {string} config */
function typecheck(config) {
  const run = spawnSync(
    process.execPath,
    tscArgv(['-p', relative(ROOT, config), '--noEmit', '--incremental', 'false', '--pretty', 'false']),
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 },
  );
  return { status: run.status ?? 1, output: `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? String(run.error) : ''}` };
}

const width = Math.max(...programs.map(({ label }) => label.length));
const digits = String(programs.length).length;
const failed = [];
for (const [index, { label, config, files }] of programs.entries()) {
  const { status, output } =
    files === 0
      ? { status: 1, output: `${relative(ROOT, config)} has no root files, so its program checks nothing.` }
      : typecheck(config);
  /** @type {Record<string, number>} */
  const codes = {};
  for (const [, code] of output.matchAll(/error (TS\d+)/g)) codes[code] = (codes[code] ?? 0) + 1;
  const tally = Object.entries(codes).map(([code, count]) => `${count} ${code}`).join(', ');
  const verdict = status === 0 ? 'ok' : `FAIL ${files === 0 ? 'no root files' : tally || `exit ${status}`}`;
  console.log(`${String(index + 1).padStart(digits)}/${programs.length} ${label.padEnd(width)} ${verdict}`);
  if (status !== 0) failed.push({ label, output });
}

for (const { label, output } of failed) console.log(`\n--- ${label}\n${output.trimEnd()}`);
if (failed.length > 0) {
  console.log(`\n${failed.length} of ${programs.length} failed: ${failed.map(({ label }) => label).join(', ')}`);
  process.exit(1);
}
