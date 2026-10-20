import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pruneOlderThan } from './prune-older-than.mjs';

let root: string;
const put = (path: string, ageS: number) => {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, 'x');
  const at = Date.now() / 1000 - ageS;
  utimesSync(full, at, at);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('pruneOlderThan', () => {
  it('removes old files at any depth and keeps new ones', () => {
    put('old', 100);
    put('nested/old', 100);
    put('nested/new', 1);
    expect(pruneOlderThan(root, Date.now() - 50_000)).toBe(2);
    expect(existsSync(join(root, 'old'))).toBe(false);
    expect(existsSync(join(root, 'nested/old'))).toBe(false);
    expect(existsSync(join(root, 'nested/new'))).toBe(true);
  });

  it('does nothing for a directory that does not exist', () => {
    expect(pruneOlderThan(join(root, 'missing'), Date.now())).toBe(0);
  });
});
