import { describe, expect, it } from 'vitest';
import { createBvh } from './bvh';

function tree() {
  return createBvh<string>(2, [['a', [0, 0, 1, 1]], ['b', [5, 5, 6, 6]]]);
}

function keys(run: (visit: (k: string) => void) => void): string[] {
  const out: string[] = [];
  run((k) => { out.push(k); });
  return out;
}

describe('BVH queries with an unusable query', () => {
  it('a point with a NaN coordinate visits nothing', () => {
    const t = tree();
    expect(keys((v) => t.queryPoint([NaN, 5], v))).toEqual([]);
    expect(keys((v) => t.queryPoint([0.5, 0.5], v))).toEqual(['a']);
  });

  it('a box with a NaN or missing coordinate visits nothing', () => {
    const t = tree();
    expect(keys((v) => t.queryBox([0, NaN, 10, 10], v))).toEqual([]);
    expect(keys((v) => t.queryBox([0, 0, 10], v))).toEqual([]);
    const t3 = createBvh<string>(3, [['a', [0, 0, 0, 1, 1, 1]]]);
    expect(keys((v) => t3.queryBox([0, 0, 1, 1], v))).toEqual([]);
  });

  it('a half-space with a NaN or short normal, or a NaN offset, visits nothing', () => {
    const t = tree();
    expect(keys((v) => t.queryHalfSpaces([{ normal: [1, 0], offset: NaN }], v))).toEqual([]);
    expect(keys((v) => t.queryHalfSpaces([{ normal: [NaN, 0], offset: 0 }], v))).toEqual([]);
    expect(keys((v) => t.queryHalfSpaces([{ normal: [1], offset: 0 }], v))).toEqual([]);
    expect(keys((v) => t.queryHalfSpaces([{ normal: [1, 0], offset: -3 }], v))).toEqual(['b']);
  });
});
