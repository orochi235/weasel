/**
 * The test files a branch's last fleet run failed in, so its next run starts with them and stops the
 * moment one fails again rather than spending the rest of the suite to learn it.
 *
 * Kept in the repository's common git directory (shared by every worktree), one entry per branch:
 * a passing run clears its branch, and a write drops the entries of branches that no longer exist.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { MARKER } from './fleet-tree.mjs';

const STORE = 'fleet-failed.json';

/** The test file a `fleet-fail:` line names, or undefined for a gate step or any other line. */
export const failedFileOf = (line) => /^fleet-fail: (?!gate )\S+ (\S+) :: /.exec(line)?.[1];

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const storeAt = (root) => {
  const dir = git(root, 'rev-parse', '--git-common-dir');
  return join(isAbsolute(dir) ? dir : join(root, dir), STORE);
};

const readStore = (root) => {
  const at = storeAt(root);
  try {
    return existsSync(at) ? JSON.parse(readFileSync(at, 'utf8')) : {};
  } catch {
    return {};
  }
};

/** The files `branch`'s last run failed in, oldest record kept only until its next run. */
export const firstFor = (root, branch) => (branch ? readStore(root)[branch]?.files ?? [] : []);

/** Records `files` as what `branch`'s run failed in; an empty list clears the branch. */
export const recordFailed = (root, branch, files) => {
  if (!branch) return;
  const live = new Set(git(root, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n'));
  const store = Object.fromEntries(Object.entries(readStore(root)).filter(([b]) => b !== branch && live.has(b)));
  if (files.length > 0) store[branch] = { files: [...new Set(files)].sort(), at: new Date().toISOString() };
  writeFileSync(storeAt(root), `${JSON.stringify(store, null, 1)}\n`);
};

/** On a fleet node: the files the tree's marker says to run first, relative to `root`; none off the fleet. */
export const firstInTree = (root) => {
  try {
    return JSON.parse(readFileSync(join(root, MARKER), 'utf8')).first ?? [];
  } catch {
    return [];
  }
};
