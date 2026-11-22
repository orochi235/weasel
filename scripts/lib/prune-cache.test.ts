import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pruneCache } from './prune-cache.mjs';

let root: string;
const put = (path: string, ageS: number, bytes = 1) => {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, 'x'.repeat(bytes));
  const at = Date.now() / 1000 - ageS;
  utimesSync(full, at, at);
};
const there = (path: string) => existsSync(join(root, path));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('pruneCache', () => {
  it('removes old files at any depth and keeps new ones', () => {
    put('old', 100);
    put('nested/old', 100);
    put('nested/new', 1);
    expect(pruneCache(root, { before: Date.now() - 50_000 })).toBe(2);
    expect(there('old')).toBe(false);
    expect(there('nested/old')).toBe(false);
    expect(there('nested/new')).toBe(true);
  });

  it('removes the oldest files across directories until the rest fit the size', () => {
    put('stale/a', 300, 10);
    put('stale/b', 200, 10);
    put('live/c', 20, 10);
    put('live/d', 10, 10);
    expect(pruneCache(root, { before: 0, maxBytes: 25 })).toBe(2);
    expect([there('stale/a'), there('stale/b'), there('live/c'), there('live/d')]).toEqual([false, false, true, true]);
  });

  it('does nothing for a directory that does not exist', () => {
    expect(pruneCache(join(root, 'missing'), { before: Date.now() })).toBe(0);
  });
});
