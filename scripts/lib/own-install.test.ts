import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertOwnInstall, ownInstallProblem } from './own-install.mjs';

describe('ownInstallProblem', () => {
  let base: string;
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  const setup = () => {
    base = mkdtempSync(join(tmpdir(), 'own-install-'));
    const main = join(base, 'main');
    const worktree = join(main, '.claude', 'worktrees', 'w');
    mkdirSync(join(main, 'node_modules', '@weasel-js', 'core'), { recursive: true });
    mkdirSync(worktree, { recursive: true });
    return { main, worktree };
  };

  it('passes a checkout with its own workspace links', () => {
    const { main } = setup();
    expect(ownInstallProblem(main)).toBeNull();
  });

  it('names the checkout a nested worktree would borrow from, and the fix', () => {
    const { main, worktree } = setup();
    const problem = ownInstallProblem(worktree);
    expect(problem).toContain(`${main}/node_modules`);
    expect(problem).toContain(`Run \`npm ci\` in ${worktree}`);
  });

  it('does not count a node_modules holding only a cache', () => {
    const { worktree } = setup();
    mkdirSync(join(worktree, 'node_modules', '.cache'), { recursive: true });
    expect(() => assertOwnInstall(worktree)).toThrow(/npm ci/);
  });
});
