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
 *   npm run test:fleet -- --no-checks  # skip ci-checks.gate.ts's checks, which ran on this commit already
 *
 * The browser project runs as a job of its own on a node whose GPU is idle and that nobody is using,
 * beside a job running the rest, when one is free (`scripts/lib/fleet-parts.mjs`); WEASEL_FLEET_SPLIT=0,
 * or naming a node, keeps it one job.
 *
 * On a branch other than main, the test projects run only the files whose imports reach what the
 * branch changes, and the gate skips the slow checks whose inputs it leaves alone
 * (`scripts/lib/gate-inputs.mjs`). main runs everything.
 */
import { fileURLToPath } from 'node:url';
import { openCommitTree } from './lib/commit-tree.mjs';
import { killOnSignal, runSuite } from './lib/fleet-parts.mjs';
import { armTree, changedFiles, lockScope, runsEverything } from './lib/fleet-tree.mjs';
import { failedFileOf, firstFor, recordFailed } from './lib/fleet-first.mjs';
import { SCOPED, TRIGGERS } from './lib/fleet-triggers.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const args = process.argv.slice(2);
const sinceAt = args.findIndex((arg) => arg === '--since' || arg.startsWith('--since='));
const since = sinceAt < 0 ? undefined : args[sinceAt].includes('=') ? args.splice(sinceAt, 1)[0].slice('--since='.length) : args.splice(sinceAt, 2)[1];
if (sinceAt >= 0 && (!since || since.startsWith('-'))) {
  console.error('fleet-test: --since needs a ref');
  process.exit(2);
}
const noChecks = args.includes('--no-checks');
const argv = args.filter((arg) => arg !== '--full' && arg !== '--no-checks');
const full = argv.length < args.length - Number(noChecks);
const [first, ...rest] = argv;
const named = first && !first.startsWith('-');
const ontoArgs = named ? rest : argv;
const { commit, branch, tree, drop, git } = openCommitTree(ROOT, named ? first : 'HEAD', 'fleet-');
const jobs = [];
killOnSignal(jobs);
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
  const newer = since ? git('merge-base', commit, since) : isAncestor(local, base) ? base : local;
  const branchRun = Boolean(branch) && branch !== 'main' && !full;
  const select = branchRun ? Object.keys(diff(newer)) : undefined;
  const reshaped = branchRun
    ? git('diff', '--name-only', '--no-renames', '--diff-filter=AD', '-z', newer, commit).split('\0').filter(Boolean)
    : undefined;
  const lockAt = (ref) => JSON.parse(git('show', `${ref}:package-lock.json`));
  const locked = select?.includes('package-lock.json') ? lockScope(lockAt(newer), lockAt(commit)) : undefined;
  const first = firstFor(ROOT, branch);
  armTree(tree, { commit, branch: branch || undefined, files, select, reshaped, ...(locked !== undefined && { lockScope: locked }), ...(first.length > 0 && { first }), ...(noChecks && { checks: false }) }, { plan: true });
  if (noChecks) console.log('fleet-test: --no-checks, so the gate skips the checks ci.yml runs as steps');
  if (first.length > 0) console.log(`fleet-test: running first the ${first.length} file(s) this branch's last run failed in, stopping if one fails again`);
  console.log(`fleet-test: tree check armed for ${commit.slice(0, 9)}, ${Object.keys(files).length} changed path(s)`);
  if (select) console.log(`fleet-test: selecting from the ${select.length} path(s) the branch changes against ${newer.slice(0, 9)}`);
  if (locked !== undefined) console.log(`fleet-test: the lockfile change reaches ${locked ? locked.join(', ') || 'no workspace' : 'external packages, so everything runs'}`);
  console.log(
    select
      ? "fleet-test: running the tests the branch reaches, or all of them if it changes one of scripts/lib/fleet-triggers.mjs's triggers; --full runs them all"
      : 'fleet-test: running every test',
  );
  // onto remembers a suite's test count per scope to start the next run's bar from, and a branch's
  // few tests would otherwise seed a full run's.
  const scope = !select || runsEverything(select, { triggers: TRIGGERS, scoped: SCOPED, lockScope: locked }) ? 'full' : 'branch';
  const failed = [];
  const onLine = (line) => {
    const file = failedFileOf(line);
    if (file) failed.push(file);
  };
  status = await runSuite({ tree, base, scope, ontoArgs, jobs, onLine, say: (line) => console.log(`fleet-test: ${line}`) });
  recordFailed(ROOT, branch, status === 0 ? [] : failed);
} finally {
  drop();
}
process.exit(status);
