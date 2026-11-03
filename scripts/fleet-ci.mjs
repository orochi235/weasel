#!/usr/bin/env node
/**
 * Runs ci.yml's steps on the fleet against a commit, through `scripts/ci-run.mjs` on the node.
 *
 *   postbuild  the first build and every step after it, on `.nvmrc`'s Node: the manifest,
 *              tree-shake and React-free checks and both consumer smokes, which read `dist` and so
 *              are not in the gate project.
 *
 *   npm run test:fleet:postbuild                 # HEAD
 *   npm run test:fleet:postbuild -- <commit>     # any commit
 *   npm run test:fleet:postbuild -- HEAD --node studio   # the rest goes to `onto do`
 *
 * It builds in a tree of its own on the node (`weasel-postbuild`), never the one test runs share:
 * their vitest runs resolve source, but a `dist` they did not build would turn a skipped
 * built-output check into a run against stale output.
 */
import { fileURLToPath } from 'node:url';
import { openCommitTree, ontoWhenFree } from './lib/commit-tree.mjs';
import { armTree, changedFiles } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const say = (line) => console.log(`fleet-ci: ${line}`);
const NVM = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh"';

const MODES = {
  postbuild: () => [{
    label: 'post-build steps', tree: 'weasel-postbuild', kind: 'build', icon: 'hammer', task: 'postbuild', expect: '10m',
    about: "Builds every package as ci.yml does and runs its post-build checks: manifests, tree-shaking, React-free subpaths, both consumer smokes, the site builds.",
    shell: `${NVM} && nvm use >/dev/null && exec node scripts/ci-run.mjs built`,
  }],
};

const [mode, ...args] = process.argv.slice(2);
if (!MODES[mode]) {
  say(`usage: fleet-ci.mjs ${Object.keys(MODES).join('|')} [commit] [onto do flags]`);
  process.exit(2);
}
const [first, ...rest] = args;
const named = first && !first.startsWith('-');
const ontoArgs = named ? rest : args;
const { commit, branch, tree, drop, git } = openCommitTree(ROOT, named ? first : 'HEAD', `${mode}-`);

let status = 0;
try {
  say(`${git('log', '-1', '--format=%h %s', commit)}${branch ? ` (${branch})` : ''}`);
  const base = git('merge-base', commit, 'origin/main');
  const commitEnv = armTree(tree, { commit, files: changedFiles(git('diff', '--raw', '--no-renames', '--no-abbrev', '-z', base, commit)) });
  const jobs = MODES[mode](tree);
  for (const job of jobs) {
    const started = Date.now();
    const result = await ontoWhenFree(
      ['do', '--kind', job.kind, '--icon', job.icon, '--in', job.tree, '--ref', base, '--timeout', '90m',
        '--env', commitEnv,'--task', `${job.task}-${(branch || commit.slice(0, 9)).replace(/[^A-Za-z0-9.-]/g, '-')}`, '--about', job.about,
        '--expect', job.expect, ...ontoArgs, '--', 'bash', '-c', job.shell],
      { cwd: tree, say },
    );
    say(`${job.label} ${result === 0 ? 'passed' : 'failed'} in ${((Date.now() - started) / 60000).toFixed(1)} min wall`);
    status ||= result;
  }
} finally {
  drop();
}
process.exit(status);
