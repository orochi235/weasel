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
import { cli } from './lib/help.mjs';

const { positionals, rest } = cli(import.meta.url, {
  summary: "`npm test` inside a package: its test files (or the ones named, as paths in the package), run from the repo root under the vitest projects that own them. One worker unless --maxWorkers asks for more.",
  positionals: '[<file or filter>…]',
  passthrough: true,
  notes: "Every other flag goes to `vitest run`; `-- --help` prints vitest's own help.",
});

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pkg = process.cwd();
const here = relative(ROOT, pkg);
if (here.startsWith('..') || !existsSync(join(pkg, 'package.json'))) {
  console.error(`package-test: run this from a package directory, not ${pkg}.`);
  process.exit(2);
}

const args = [...positionals, ...rest].map((arg) => (!arg.startsWith('-') && existsSync(join(pkg, arg)) ? join(here, arg) : arg));
const filters = args.filter((arg) => !arg.startsWith('-'));
const workers = args.some((arg) => arg.startsWith('--maxWorkers')) ? [] : ['--maxWorkers=1'];
const { status } = spawnSync('npx', ['vitest', 'run', ...(filters.length ? [] : [`${here}/`]), ...workers, ...args], {
  cwd: ROOT,
  stdio: 'inherit',
});
process.exit(status ?? 1);
