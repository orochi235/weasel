#!/usr/bin/env node
/**
 * Runs the suite on the fleet against a commit, never the working tree.
 *
 * `onto test` ships whatever is on disk, so a run started from a checkout other
 * sessions are editing tests their half-finished files and blames the commit.
 * This checks the commit out into a throwaway worktree, runs `onto test` on
 * that, and removes it.
 *
 *   npm run test:fleet                 # HEAD
 *   npm run test:fleet -- <commit>     # any commit
 *   npm run test:fleet -- HEAD --node studio    # the rest goes to `onto test`
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUSY_TRIES = 30;
const BUSY_WAIT_S = 30;
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const [first, ...rest] = process.argv.slice(2);
const named = first && !first.startsWith('-');
const commit = git('rev-parse', '--verify', `${named ? first : 'HEAD'}^{commit}`);
const ontoArgs = named ? rest : process.argv.slice(2);

const main = git('worktree', 'list', '--porcelain').split('\n')[0].replace(/^worktree /, '');
const tree = mkdtempSync(join(main, '.worktrees', 'fleet-'));
git('worktree', 'add', '--detach', '--force', tree, commit);

let status = 1;
try {
  console.log(`fleet-test: ${git('log', '-1', '--format=%h %s', commit)}`);
  const base = git('merge-base', commit, 'origin/main');
  // A node runs one job per tree, so a run started while another session's is on the chosen node is
  // refused. Wait for it rather than fail: the refusal comes before anything has run.
  for (let attempt = 1; ; attempt++) {
    const run = spawnSync('onto', ['test', '--dir', tree, '--ref', base, ...ontoArgs], {
      stdio: ['inherit', 'inherit', 'pipe'],
      encoding: 'utf8',
    });
    process.stderr.write(run.stderr ?? '');
    status = run.status ?? 1;
    if (!/working tree .* is busy/.test(run.stderr ?? '') || attempt === BUSY_TRIES) break;
    console.log(`fleet-test: the node's tree is busy, retrying in ${BUSY_WAIT_S}s (${attempt}/${BUSY_TRIES})`);
    spawnSync('sleep', [String(BUSY_WAIT_S)]);
  }
} finally {
  git('worktree', 'remove', '--force', tree);
  rmSync(tree, { recursive: true, force: true });
}
process.exit(status);
