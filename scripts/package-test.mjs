#!/usr/bin/env node
/**
 * `npm test` inside a package: its test files, run from the repo root under the vitest projects
 * that own them, so each gets its project's environment, setup and aliases. A bare `vitest run`
 * there finds no config, or the package's build config, and runs the files under neither.
 *
 *   npm test -w @weasel-js/geom                     # every test file in the package
 *   npm test -w @weasel-js/geom -- src/angle.test.ts   # paths are the package's own
 *
 * Other arguments pass through to vitest. One worker unless one is asked for.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pkg = process.cwd();
const here = relative(ROOT, pkg);
if (here.startsWith('..') || !existsSync(join(pkg, 'package.json'))) {
  console.error(`package-test: run this from a package directory, not ${pkg}.`);
  process.exit(2);
}

const args = process.argv.slice(2).map((arg) => (!arg.startsWith('-') && existsSync(join(pkg, arg)) ? join(here, arg) : arg));
const filters = args.filter((arg) => !arg.startsWith('-'));
const workers = args.some((arg) => arg.startsWith('--maxWorkers')) ? [] : ['--maxWorkers=1'];
const { status } = spawnSync('npx', ['vitest', 'run', ...(filters.length ? [] : [`${here}/`]), ...workers, ...args], {
  cwd: ROOT,
  stdio: 'inherit',
});
process.exit(status ?? 1);
