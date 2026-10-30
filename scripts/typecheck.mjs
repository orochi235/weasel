#!/usr/bin/env node
// `npm run typecheck`: the root program and the browser tests' (`packages/tsconfig.json`), at once.
// tsc checks on one core, so the two side by side take as long as the root one alone. Each program's
// output is printed whole when it ends, and the exit is nonzero when either fails.
//
// Both are incremental, and a fleet node keeps `.tsbuildinfo/` between runs. A fleet run of a branch
// other than main keeps its own build info, started from main's, so that its next run rechecks only
// what changed since its last: one build info shared by every branch a node runs is rechecked against
// whichever ran before it, which costs as much as no build info whenever that one changed an export
// many files import (2026-10-29, `scripts/bench-typecheck.mjs`).
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fleetBranch } from './lib/fleet-tree.mjs';

const ROOT = join(import.meta.dirname, '..');
const TSC = join(ROOT, 'node_modules/.bin/tsc');
const INFO = join(ROOT, '.tsbuildinfo');
const BRANCH_PREFIX = 'branch--';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Each program's arguments, and the build info file its tsconfig names. */
const PROGRAMS = [
  [['--noEmit'], 'main.tsbuildinfo'],
  [['--noEmit', '-p', 'packages'], 'browser-tests.tsbuildinfo'],
];

/**
 * Runs `args` against `branch`'s own build info, seeded from main's the first time, and leaves main's
 * in place after. The branch's copy is swapped into the path the tsconfig names rather than passed as
 * --tsBuildInfoFile: tsc records that option and the paths relative to it, and reading build info
 * written under any other one checks everything (2026-10-29, `seeded` in `scripts/bench-typecheck.mjs`).
 */
const tscOnBranch = async (branch, args, name) => {
  const main = join(INFO, name);
  const own = join(INFO, `${BRANCH_PREFIX}${branch.replace(/[^\w.-]+/g, '_')}--${name}`);
  const held = join(INFO, `held--${name}`);
  const hadMain = existsSync(main);
  if (hadMain) copyFileSync(main, held);
  if (existsSync(own)) copyFileSync(own, main);
  try {
    return await tsc(args);
  } finally {
    if (existsSync(main)) copyFileSync(main, own);
    if (hadMain) renameSync(held, main);
    else rmSync(main, { force: true });
  }
};

const pruneBranches = (cutoff) => {
  for (const name of readdirSync(INFO)) {
    const file = join(INFO, name);
    if (name.startsWith(BRANCH_PREFIX) && (statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? Infinity) < cutoff) rmSync(file, { force: true });
  }
};

const tsc = (args) =>
  new Promise((resolve) => {
    const child = spawn(TSC, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (error) => resolve({ code: 1, out: `${out}${error.message}\n` }));
    child.on('close', (code, signal) => resolve({ code: code ?? 1, out: signal ? `${out}tsc ${args.join(' ')}: killed by ${signal}\n` : out }));
  });

const branch = fleetBranch(ROOT, process.env);
if (branch && existsSync(INFO)) pruneBranches(Date.now() - WEEK_MS);
const results = await Promise.all(
  PROGRAMS.map(([args, name]) => (branch ? tscOnBranch(branch, args, name) : tsc(args))),
);
for (const { out } of results) if (out) process.stdout.write(out);
process.exit(results.some(({ code }) => code !== 0) ? 1 : 0);
