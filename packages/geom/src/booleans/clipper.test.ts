import { describe, expect, it, vi } from 'vitest';
import type { MultiPolygon } from './adapter';
import { clipper } from './clipper';

const failing = vi.hoisted(() => ({ calls: 0 }));

vi.mock('polygon-clipping', () => {
  const union = (head: MultiPolygon): MultiPolygon => {
    if (failing.calls-- > 0) throw new Error('unclosed ring');
    return head;
  };
  return { default: { union, intersection: union, difference: union, xor: union } };
});

describe('clipper', () => {
  it('keeps distinct float32 vertices apart on its coarsest retry grid', () => {
    failing.calls = 3;
    const near = Math.fround(1 + 2 ** -23);
    const square: MultiPolygon = [[[[0, 0], [1, 0], [near, 1], [0, 1], [0, 0]]]];
    const [[ring]] = clipper.union(square);
    expect(ring[1][0]).not.toBe(ring[2][0]);
  });

  it('throws rather than snap a small shape far from the origin to a grid coarser than it', () => {
    failing.calls = 3;
    const x = 1e8;
    const square: MultiPolygon = [[[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]]];
    expect(() => clipper.union(square)).toThrow('unclosed ring');
  });

  it('retries a small shape far from the origin on a grid fine enough to keep it', () => {
    failing.calls = 1;
    const x = 1e8;
    const square: MultiPolygon = [[[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]]];
    const [[ring]] = clipper.union(square);
    expect(ring[2][0] - ring[0][0]).toBeCloseTo(1, 3);
  });
});
