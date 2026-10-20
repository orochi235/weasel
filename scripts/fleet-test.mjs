#!/usr/bin/env node
/**
 * Runs the suite on the fleet against a commit, never the working tree.
 *
 * `onto test` ships whatever is on disk, so a run started from a checkout other
 * sessions are editing tests their half-finished files and blames the commit.
 * The job is named for the branch: the one named, or the one checked out when
 * HEAD is tested.
 *
 *   npm run test:fleet                 # HEAD
 *   npm run test:fleet -- <commit>     # any commit
 *   npm run test:fleet -- HEAD --node studio    # the rest goes to `onto test`
 *   npm run test:fleet -- --full       # every test, on a branch too
 *
 * On a branch other than main, the test projects run only the files whose imports reach what the
 * branch changes; the gate project always runs whole. main runs everything.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armTree, changedFiles } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUSY_TRIES = 30;
const BUSY_WAIT_S = 30;
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

/** `onto` with its output passed straight through, and what it wrote to stderr kept to read after. */
const ontoTest = (args) =>
  new Promise((done) => {
    const child = spawn('onto', args, { stdio: ['inherit', 'inherit', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', (error) => done({ status: 1, stderr: String(error) }));
    child.on('close', (status) => done({ status: status ?? 1, stderr }));
  });

const argv = process.argv.slice(2).filter((arg) => arg !== '--full');
const full = argv.length < process.argv.length - 2;
const [first, ...rest] = argv;
const named = first && !first.startsWith('-');
const commit = git('rev-parse', '--verify', `${named ? first : 'HEAD'}^{commit}`);
const ontoArgs = named ? rest : argv;

/** The local branch `ref` names, or '' for a commit, a tag, or a detached HEAD. */
const branchOf = (ref) => {
  try {
    const name = git('rev-parse', '--abbrev-ref', ref);
    git('show-ref', '--verify', '--quiet', `refs/heads/${name}`);
    return name;
  } catch {
    return '';
  }
};
const branch = branchOf(named ? first : 'HEAD');
// The throwaway tree is detached, so onto cannot read the branch from it.
if (branch && !ontoArgs.includes('--branch')) ontoArgs.unshift('--branch', branch);

const main = git('worktree', 'list', '--porcelain').split('\n')[0].replace(/^worktree /, '');
mkdirSync(join(main, '.worktrees'), { recursive: true });
const tree = mkdtempSync(join(main, '.worktrees', 'fleet-'));
git('worktree', 'add', '--detach', '--force', tree, commit);
const dropTree = () => {
  git('worktree', 'remove', '--force', tree);
  rmSync(tree, { recursive: true, force: true });
};
// `finally` never runs when a signal kills the process, and a killed run otherwise leaves its tree.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => {
    dropTree();
    process.exit(128 + { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[signal]);
  });
}

let status = 1;
try {
  console.log(`fleet-test: ${git('log', '-1', '--format=%h %s', commit)}${branch ? ` (${branch})` : ''}`);
  const base = git('merge-base', commit, 'origin/main');
  // onto's own check that the tree is still the one it synced cannot tell two sessions on this
  // machine apart, so the suite checks the tree itself: `scripts/fleet-tree.gate.ts`.
  const files = changedFiles(git('diff', '--raw', '--no-renames', '--no-abbrev', '-z', base, commit));
  const select = Boolean(branch) && branch !== 'main' && !full;
  armTree(tree, { commit, files, select });
  console.log(`fleet-test: tree check armed for ${commit.slice(0, 9)}, ${Object.keys(files).length} changed path(s)`);
  console.log(select ? 'fleet-test: running the tests the branch reaches; --full runs them all' : 'fleet-test: running every test');
  // A node runs one job per tree, so a run started while another session's is on the chosen node is
  // refused. Wait for it rather than fail: the refusal comes before anything has run.
  for (let attempt = 1; ; attempt++) {
    const run = await ontoTest(['test', '--dir', tree, '--ref', base, ...ontoArgs]);
    status = run.status;
    if (!/working tree .* is busy/.test(run.stderr) || attempt === BUSY_TRIES) break;
    console.log(`fleet-test: the node's tree is busy, retrying in ${BUSY_WAIT_S}s (${attempt}/${BUSY_TRIES})`);
    spawnSync('sleep', [String(BUSY_WAIT_S)]);
  }
} finally {
  dropTree();
}
process.exit(status);
