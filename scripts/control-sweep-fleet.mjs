#!/usr/bin/env node
/**
 * `npm run sweep:controls`: runs the control sweep on a fleet node with a browser, against a commit.
 *
 *   npm run sweep:controls -- [--only id,id] [--out dir] [--ref <commit>] [--node <name>] [--tree <name>] [sweep flags…]
 *
 * The commit (HEAD unless `--ref`) is checked out into a throwaway worktree and shipped from there, as
 * `test:fleet` does. The run comes back to `<out>/<run>` (`.control-sweep` by default), which keeps its
 * newest 7 runs. `--tree` names the node tree it runs in, so a second sweep need not sync over a
 * running one. Exits with the sweep's code: 1 when a control is dead.
 */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCommitTree, ontoWhenFree } from './lib/commit-tree.mjs';
import { pruneRuns } from './control-sweep/judge.mjs';
import { ontoArgs, readRun } from './control-sweep/fleet.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const say = (line) => console.log(`sweep:controls: ${line}`);

const argv = process.argv.slice(2);
const take = (flag) => {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  const [, v] = argv.splice(i, 2);
  return v;
};
const out = resolve(take('--out') ?? join(ROOT, '.control-sweep'));
const ref = take('--ref') ?? 'HEAD';
const node = take('--node');
const nodeTree = take('--tree');
const only = take('--only');
const sweepArgs = [...(only ? ['--only', only] : []), ...argv];

// onto caps --about at 400 characters, which a long --only list runs past.
const ids = only?.split(',') ?? [];
const demosNamed = !only ? 'every demo' : ids.length <= 4 ? `the demos ${only}` : `${ids.length} demos (${ids.slice(0, 3).join(', ')}, …)`;
const { commit, branch, tree, drop, git } = openCommitTree(ROOT, ref, 'control-sweep-');
let code = 2;
try {
  const run = new Date().toISOString().replace(/[:.]/g, '-');
  const to = join(out, run);
  say(`${git('log', '-1', '--format=%h %s', commit)}${branch ? ` (${branch})` : ''}${only ? `, demos ${only}` : ', every demo'}`);
  const status = await ontoWhenFree(ontoArgs({
    run, to, node, sweepArgs, ...(nodeTree ? { tree: nodeTree } : {}),
    ref: git('merge-base', commit, 'origin/main'),
    task: `control-sweep-${(branch || commit.slice(0, 9)).replace(/[^A-Za-z0-9.-]/g, '-')}`,
    about: `Operates every control in ${demosNamed} at ${commit.slice(0, 10)} in headless Chromium and reports each that changes nothing.`,
  }), { cwd: tree, say });
  const { exit, summary } = readRun(to);
  if (exit === undefined) say(`the sweep did not run (onto exited ${status})`);
  else say(`exit ${exit}${summary ? `: ${summary.dead} dead of ${summary.controls} controls in ${summary.demos} demos` : ''}; records in ${to}`);
  code = exit ?? 2;
  pruneRuns(out, 7);
} finally {
  drop();
}
process.exit(code);
