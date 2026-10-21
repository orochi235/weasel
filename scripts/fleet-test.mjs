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
import { fileURLToPath } from 'node:url';
import { openCommitTree, ontoWhenFree } from './lib/commit-tree.mjs';
import { armTree, changedFiles } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const argv = process.argv.slice(2).filter((arg) => arg !== '--full');
const full = argv.length < process.argv.length - 2;
const [first, ...rest] = argv;
const named = first && !first.startsWith('-');
const ontoArgs = named ? rest : argv;
const { commit, branch, tree, drop, git } = openCommitTree(ROOT, named ? first : 'HEAD', 'fleet-');
// The throwaway tree is detached, so onto cannot read the branch from it.
if (branch && !ontoArgs.includes('--branch')) ontoArgs.unshift('--branch', branch);

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
  console.log(
    select
      ? "fleet-test: running the tests the branch reaches, or all of them if it changes one of vitest.config.ts's triggers; --full runs them all"
      : 'fleet-test: running every test',
  );
  status = await ontoWhenFree(['test', '--dir', tree, '--ref', base, ...ontoArgs], {
    say: (line) => console.log(`fleet-test: ${line}`),
  });
} finally {
  drop();
}
process.exit(status);
