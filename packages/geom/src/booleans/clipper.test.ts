import { describe, expect, it, vi } from 'vitest';
import type { MultiPolygon } from './adapter';

vi.mock('polygon-clipping', () => {
  let calls = 0;
  const union = (head: MultiPolygon): MultiPolygon => {
    if (++calls < 4) throw new Error('unclosed ring');
    return head;
  };
  return { default: { union, intersection: union, difference: union, xor: union } };
});

describe('clipper', () => {
  it('keeps distinct float32 vertices apart on its coarsest retry grid', async () => {
    const { clipper } = await import('./clipper');
    const near = Math.fround(1 + 2 ** -23);
    const square: MultiPolygon = [[[[0, 0], [1, 0], [near, 1], [0, 1], [0, 0]]]];
    const [[ring]] = clipper.union(square);
    expect(ring[1][0]).not.toBe(ring[2][0]);
  });
});
