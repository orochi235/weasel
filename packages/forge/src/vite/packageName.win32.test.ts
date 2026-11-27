import { describe, expect, it, vi } from 'vitest';
import { packageNameOf } from './packageName.ts';

vi.mock('node:path', async (actual) => {
  const path = await actual<typeof import('node:path')>();
  return { ...path.win32, default: path.win32 };
});

const files = new Map([['C:\\repo\\packages\\x\\package.json', JSON.stringify({ name: '@a/x' })]]);
vi.mock('node:fs', () => ({
  existsSync: (file: string) => files.has(file),
  readFileSync: (file: string) => files.get(file),
}));

describe('packageNameOf on Windows', () => {
  it('finds the package under a top git writes with forward slashes', () => {
    expect(packageNameOf('C:\\repo\\packages\\x\\src\\a.ts', 'C:/repo')).toBe('@a/x');
  });
});
