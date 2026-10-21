#!/usr/bin/env node
/**
 * Runs ci.yml's steps on the fleet against a commit, through `scripts/ci-run.mjs` on the node.
 *
 *   postbuild  the first build and every step after it, on `.nvmrc`'s Node: the manifest,
 *              tree-shake and React-free checks and both consumer smokes, which read `dist` and so
 *              are not in the gate project.
 *   matrix     the whole job, once for each Node version in ci.yml's matrix other than `.nvmrc`'s,
 *              which every fleet node runs already.
 *
 *   npm run test:fleet:postbuild                 # HEAD
 *   npm run test:fleet:matrix -- <commit>        # any commit
 *   npm run test:fleet:postbuild -- HEAD --node studio   # the rest goes to `onto do`
 *
 * Each builds in a tree of its own on the node (`weasel-postbuild`, `weasel-node22`), never the one
 * test runs share: their vitest runs resolve source, but a `dist` they did not build would turn a
 * skipped built-output check into a run against stale output, and an install under another Node
 * leaves native modules built for its ABI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { offFleetNodes, readCi } from './lib/ci-steps.mjs';
import { openCommitTree, ontoWhenFree } from './lib/commit-tree.mjs';
import { COMMIT_ENV, changedFiles, writeMarker } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const say = (line) => console.log(`fleet-ci: ${line}`);
const NVM = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh"';

/**
 * Selects Node `major` on the node, as setup-node would: its newest release, installed if missing.
 * Older releases of that major are uninstalled, so each node keeps one. Offline, it uses what it has.
 */
const onMajor = (major) =>
  `${NVM} && { nvm install ${major} >/dev/null 2>&1 || true; } && nvm use ${major} >/dev/null && ` +
  `for old in $(cd "$NVM_DIR/versions/node" && ls -d v${major}.*); do [ "$old" = "$(nvm current)" ] || nvm uninstall "$old" >/dev/null; done; ` +
  'exec node scripts/ci-run.mjs job';

const MODES = {
  postbuild: () => [{
    label: 'post-build steps', tree: 'weasel-postbuild', kind: 'build', icon: 'hammer', task: 'postbuild', expect: '10m',
    about: "Builds every package as ci.yml does and runs its post-build checks: manifests, tree-shaking, React-free subpaths, both consumer smokes, the site builds.",
    shell: `${NVM} && nvm use >/dev/null && exec node scripts/ci-run.mjs built`,
  }],
  matrix: (tree) => {
    const { nodes } = readCi(readFileSync(join(tree, '.github/workflows/ci.yml'), 'utf8'));
    return offFleetNodes(nodes, readFileSync(join(tree, '.nvmrc'), 'utf8')).map((major) => ({
      label: `Node ${major}`, tree: `weasel-node${major}`, kind: 'test', icon: 'checklist', task: `node${major}`, expect: '20m',
      about: `Runs every step of ci.yml's job under Node ${major}, which ci.yml's matrix tests and no fleet node runs by default.`,
      shell: onMajor(major),
    }));
  },
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
  writeMarker(tree, { commit, files: changedFiles(git('diff', '--raw', '--no-renames', '--no-abbrev', '-z', base, commit)) });
  const jobs = MODES[mode](tree);
  if (jobs.length === 0) say("ci.yml's matrix runs no Node version the fleet does not");
  for (const job of jobs) {
    const started = Date.now();
    const result = await ontoWhenFree(
      ['do', '--kind', job.kind, '--icon', job.icon, '--in', job.tree, '--ref', base, '--timeout', '90m',
        '--env', `${COMMIT_ENV}=${commit}`, '--task', `${job.task}-${branch || commit.slice(0, 9)}`, '--about', job.about,
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
