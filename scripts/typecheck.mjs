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
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fleetBranch } from './lib/fleet-tree.mjs';
import { pruneOlderThan } from './lib/prune-older-than.mjs';

const ROOT = join(import.meta.dirname, '..');
const TSC = join(ROOT, 'node_modules/.bin/tsc');
const INFO = join(ROOT, '.tsbuildinfo');
const BRANCHES = join(INFO, 'branches');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Each program's arguments, and the build info file its tsconfig names. */
const PROGRAMS = [
  [['--noEmit'], 'main.tsbuildinfo'],
  [['--noEmit', '-p', 'packages'], 'browser-tests.tsbuildinfo'],
];

/** The build info `name` is kept in for `branch`, seeded from main's the first time. */
const branchInfo = (branch, name) => {
  const dir = join(BRANCHES, branch.replace(/[^\w.-]+/g, '_'));
  const file = join(dir, name);
  if (!existsSync(file) && existsSync(join(INFO, name))) {
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(INFO, name), file);
  }
  return file;
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
if (branch) pruneOlderThan(BRANCHES, Date.now() - WEEK_MS);
const results = await Promise.all(
  PROGRAMS.map(([args, name]) => tsc(branch ? [...args, '--tsBuildInfoFile', branchInfo(branch, name)] : args)),
);
for (const { out } of results) if (out) process.stdout.write(out);
process.exit(results.some(({ code }) => code !== 0) ? 1 : 0);
