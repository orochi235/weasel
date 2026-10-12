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
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const [first, ...rest] = process.argv.slice(2);
const named = first && !first.startsWith('-');
const commit = git('rev-parse', '--verify', `${named ? first : 'HEAD'}^{commit}`);
const ontoArgs = named ? rest : process.argv.slice(2);

const main = git('worktree', 'list', '--porcelain').split('\n')[0].replace(/^worktree /, '');
mkdirSync(join(main, '.worktrees'), { recursive: true });
const tree = mkdtempSync(join(main, '.worktrees', 'fleet-'));
git('worktree', 'add', '--detach', '--force', tree, commit);

let status = 1;
try {
  console.log(`fleet-test: ${git('log', '-1', '--format=%h %s', commit)}`);
  const base = git('merge-base', commit, 'origin/main');
  status = spawnSync('onto', ['test', '--dir', tree, '--ref', base, ...ontoArgs], { stdio: 'inherit' }).status ?? 1;
} finally {
  git('worktree', 'remove', '--force', tree);
  rmSync(tree, { recursive: true, force: true });
}
process.exit(status);
