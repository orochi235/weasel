import { describe, expect, it } from 'vitest';
import { buildInOrder } from './build-workspaces.mjs';

describe('buildInOrder', () => {
  it('builds every workspace in order when all pass', () => {
    const built: string[] = [];
    expect(buildInOrder(['a', 'b', 'c'], (n) => (built.push(n), 0))).toBeNull();
    expect(built).toEqual(['a', 'b', 'c']);
  });

  it('stops at the first failure and names it', () => {
    const built: string[] = [];
    const failed = buildInOrder(['a', 'b', 'c'], (n) => (built.push(n), n === 'b' ? 2 : 0));
    expect(failed).toEqual({ name: 'b', code: 2 });
    expect(built).toEqual(['a', 'b']);
  });
});
