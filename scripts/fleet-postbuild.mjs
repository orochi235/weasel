#!/usr/bin/env node
/**
 * Runs ci.yml's build and every step after it on the fleet, against a commit: the
 * manifest, tree-shake and React-free checks and both consumer smokes, which read
 * `dist` and so are not in the gate project. `scripts/ci-postbuild.mjs` is what runs
 * on the node.
 *
 *   npm run test:fleet:postbuild                 # HEAD
 *   npm run test:fleet:postbuild -- <commit>     # any commit
 *   npm run test:fleet:postbuild -- HEAD --node studio   # the rest goes to `onto do`
 *
 * It builds in a tree of its own on the node (`weasel-postbuild`), never the one test
 * runs share: their vitest runs resolve source, but a `dist` they did not build would
 * turn a skipped built-output check into a run against stale output.
 */
import { fileURLToPath } from 'node:url';
import { openCommitTree, ontoWhenFree } from './lib/commit-tree.mjs';
import { COMMIT_ENV, changedFiles, writeMarker } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TREE = 'weasel-postbuild';
const say = (line) => console.log(`fleet-postbuild: ${line}`);
// `onto do` runs whatever Node the node's PATH has first; the suite and ci.yml's site-build leg run on `.nvmrc`'s.
const ON_NVMRC = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh" && nvm use >/dev/null && exec node scripts/ci-postbuild.mjs';

const [first, ...rest] = process.argv.slice(2);
const named = first && !first.startsWith('-');
const ontoArgs = named ? rest : process.argv.slice(2);
const { commit, branch, tree, drop, git } = openCommitTree(ROOT, named ? first : 'HEAD', 'postbuild-');

let status = 1;
try {
  say(`${git('log', '-1', '--format=%h %s', commit)}${branch ? ` (${branch})` : ''}`);
  const base = git('merge-base', commit, 'origin/main');
  writeMarker(tree, { commit, files: changedFiles(git('diff', '--raw', '--no-renames', '--no-abbrev', '-z', base, commit)) });
  const started = Date.now();
  status = await ontoWhenFree(
    ['do', '--kind', 'build', '--icon', 'hammer', '--in', TREE, '--ref', base, '--timeout', '60m',
      '--env', `${COMMIT_ENV}=${commit}`, '--task', `postbuild-${branch || commit.slice(0, 9)}`,
      '--about', "Builds every package as ci.yml does and runs its post-build checks: manifests, tree-shaking, React-free subpaths, both consumer smokes, the site builds.",
      ...ontoArgs, '--', 'bash', '-c', ON_NVMRC],
    { cwd: tree, say },
  );
  say(`${status === 0 ? 'passed' : 'failed'} in ${((Date.now() - started) / 60000).toFixed(1)} min wall`);
} finally {
  drop();
}
process.exit(status);
