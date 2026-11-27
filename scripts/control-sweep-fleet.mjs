#!/usr/bin/env node
/**
 * `npm run sweep:controls`: runs the control sweep on a fleet node with a browser, against a commit.
 *
 *   npm run sweep:controls -- [--only id,id] [--out dir] [--ref <commit>] [--node <name>] [--tree <name>] [sweep flags…]
 *
 * The commit (HEAD unless `--ref`) is checked out into a throwaway worktree and shipped from there, as
 * `test:fleet` does. The run comes back to `<out>/<run>` (`.control-sweep` by default), which keeps its
 * newest 7 runs. `--tree` names a node tree to run in; without it onto picks a pooled tree on any node with
 * room. Exits with the sweep's code: 1 when a control is dead.
 */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCommitTree, ontoWhenFree } from './lib/commit-tree.mjs';
import { pruneRuns } from './control-sweep/judge.mjs';
import { ontoArgs, readRun } from './control-sweep/fleet.mjs';
import { SWEEP_OPTIONS } from './control-sweep.mjs';
import { cli } from './lib/help.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const say = (line) => console.log(`sweep:controls: ${line}`);

const { values } = cli(import.meta.url, {
  summary: "Runs the control sweep (scripts/control-sweep.mjs) on a fleet node with a browser, against a commit checked out into a throwaway worktree. Exits with the sweep's code: 1 when a control is dead.",
  options: {
    ref: { type: 'string', placeholder: '<commit>', default: 'HEAD', description: 'the commit to sweep' },
    out: { type: 'string', placeholder: '<dir>', description: 'where the run comes back to; keeps the newest 7 (default: .control-sweep)' },
    node: { type: 'string', placeholder: '<name>', description: 'run on this node' },
    tree: { type: 'string', placeholder: '<name>', description: 'run in this node tree rather than a pooled one onto picks' },
    ...SWEEP_OPTIONS,
  },
});
const out = resolve(values.out ?? join(ROOT, '.control-sweep'));
const { ref, node, tree: nodeTree, only } = values;
// The sweep's own flags, handed on as given.
const sweepArgs = Object.keys(SWEEP_OPTIONS).flatMap((name) => {
  const value = values[name];
  if (value === undefined || value === false) return [];
  return value === true ? [`--${name}`] : [`--${name}`, value];
});

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
