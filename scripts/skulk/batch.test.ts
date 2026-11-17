import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { catchUpWithMain, gitIn } from './batch.mjs';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A repo on `batch` branched from `main`, each with a commit of its own touching `file`s. */
const repo = (mainFile: string, batchFile: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'skulk-batch-'));
  dirs.push(dir);
  const git = gitIn(dir);
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'skulk@example.invalid');
  git('config', 'user.name', 'skulk');
  const commit = (file: string, text: string) => {
    writeFileSync(join(dir, file), text);
    git('add', file);
    git('commit', '-q', '-m', `${file}: ${text}`);
  };
  commit('base.txt', 'base');
  git('checkout', '-q', '-b', 'batch');
  commit(batchFile, 'batch');
  git('checkout', '-q', 'main');
  commit(mainFile, 'main');
  git('checkout', '-q', 'batch');
  return { dir, git };
};

describe('catchUpWithMain', () => {
  it('merges a moved main into the batch and answers the new tip', () => {
    const { dir, git } = repo('main.txt', 'batch.txt');
    const caught = catchUpWithMain(dir);
    expect(caught).toEqual({ moved: true, tip: git('rev-parse', 'HEAD') });
    expect(git('merge-base', '--is-ancestor', 'main', 'HEAD')).toBe('');
  });

  it('answers not moved when the batch already holds main', () => {
    const { dir, git } = repo('main.txt', 'batch.txt');
    catchUpWithMain(dir);
    const tip = git('rev-parse', 'HEAD');
    expect(catchUpWithMain(dir)).toEqual({ moved: false });
    expect(git('rev-parse', 'HEAD')).toBe(tip);
  });

  it('answers a conflict and leaves the batch as it was', () => {
    const { dir, git } = repo('same.txt', 'same.txt');
    const tip = git('rev-parse', 'HEAD');
    expect(catchUpWithMain(dir)).toEqual({ moved: false, conflict: true });
    expect(git('rev-parse', 'HEAD')).toBe(tip);
    expect(git('status', '--porcelain')).toBe('');
  });
});
