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
 *   npm run test:fleet -- --since <ref>   # select from what the branch changes past <ref>, not main
 *
 * On a branch other than main, the test projects run only the files whose imports reach what the
 * branch changes, and the gate skips the slow checks whose inputs it leaves alone
 * (`scripts/lib/gate-inputs.mjs`). main runs everything.
 */
import { fileURLToPath } from 'node:url';
import { openCommitTree, ontoWhenFree } from './lib/commit-tree.mjs';
import { armTree, changedFiles } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const args = process.argv.slice(2);
const sinceAt = args.indexOf('--since');
const since = sinceAt < 0 ? undefined : args.splice(sinceAt, 2)[1];
const argv = args.filter((arg) => arg !== '--full');
const full = argv.length < args.length;
const [first, ...rest] = argv;
const named = first && !first.startsWith('-');
const ontoArgs = named ? rest : argv;
const { commit, branch, tree, drop, git } = openCommitTree(ROOT, named ? first : 'HEAD', 'fleet-');
const isAncestor = (a, b) => {
  try {
    git('merge-base', '--is-ancestor', a, b);
    return true;
  } catch {
    return false;
  }
};
// The throwaway tree is detached, so onto cannot read the branch from it.
if (branch && !ontoArgs.includes('--branch')) ontoArgs.unshift('--branch', branch);

let status = 1;
try {
  console.log(`fleet-test: ${git('log', '-1', '--format=%h %s', commit)}${branch ? ` (${branch})` : ''}`);
  const base = git('merge-base', commit, 'origin/main');
  // onto's own check that the tree is still the one it synced cannot tell two sessions on this
  // machine apart, so the suite checks the tree itself: `scripts/fleet-tree.gate.ts`.
  const diff = (from) => changedFiles(git('diff', '--raw', '--no-renames', '--no-abbrev', '-z', from, commit));
  const files = diff(base);
  // The node builds the tree on `base`, which must be pushed, but the branch changes only what it
  // adds to local main: unpushed main commits would otherwise count as the branch's own changes.
  const local = git('merge-base', commit, 'main');
  const newer = since ? git('merge-base', commit, since) : isAncestor(base, local) ? local : base;
  const branchRun = Boolean(branch) && branch !== 'main' && !full;
  const select = branchRun ? Object.keys(diff(newer)) : undefined;
  const reshaped = branchRun
    ? git('diff', '--name-only', '--no-renames', '--diff-filter=AD', '-z', newer, commit).split('\0').filter(Boolean)
    : undefined;
  armTree(tree, { commit, branch: branch || undefined, files, select, reshaped }, { plan: true });
  console.log(`fleet-test: tree check armed for ${commit.slice(0, 9)}, ${Object.keys(files).length} changed path(s)`);
  if (select) console.log(`fleet-test: selecting from the ${select.length} path(s) the branch changes against ${newer.slice(0, 9)}`);
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
