import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sweepStaleTrees } from './commit-tree.mjs';

const HOST = 'here';
const LIVE = 101;
const DEAD = 202;

let root: string;
let dir: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
const tree = (name: string, owner?: { pid: number; host: string }) => {
  const path = join(dir, name);
  git('worktree', 'add', '--detach', '--force', path, 'HEAD');
  if (owner) writeFileSync(`${path}.owner`, JSON.stringify(owner));
  return path;
};
const sweep = (now = Date.now()) =>
  sweepStaleTrees(dir, git, { host: HOST, isAlive: (pid: number) => pid === LIVE, now }).map((path: string) =>
    path.slice(dir.length + 1),
  );

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'commit-tree-'));
  dir = join(root, '.worktrees');
  mkdirSync(dir);
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'root');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('sweepStaleTrees', () => {
  it('removes a tree whose creator on this host is gone, and its git registration', () => {
    const path = tree('fleet-dead', { pid: DEAD, host: HOST });
    expect(sweep()).toEqual(['fleet-dead']);
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.owner`)).toBe(false);
    expect(git('worktree', 'list')).not.toContain('fleet-dead');
  });

  it('keeps a tree whose creator is alive, or that another host created', () => {
    tree('fleet-live', { pid: LIVE, host: HOST });
    tree('postbuild-away', { pid: DEAD, host: 'elsewhere' });
    expect(sweep()).toEqual([]);
  });

  it('removes an ownerless tree only once it is a day old', () => {
    const path = tree('fleet-old');
    expect(sweep()).toEqual([]);
    const at = Date.now() / 1000 - 25 * 3600;
    utimesSync(path, at, at);
    expect(sweep()).toEqual(['fleet-old']);
  });

  it('removes an owner file whose tree is gone', () => {
    writeFileSync(join(dir, 'fleet-gone.owner'), JSON.stringify({ pid: LIVE, host: HOST }));
    sweep();
    expect(existsSync(join(dir, 'fleet-gone.owner'))).toBe(false);
  });
});
