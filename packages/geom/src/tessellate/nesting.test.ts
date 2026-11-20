import { describe, it, expect } from 'vitest';
import { nestRings } from './nesting';
import type { FlattenedContours } from './crossings';

const contours = (...rings: number[][]): FlattenedContours => {
  const flat: FlattenedContours = { coords: [], contourStarts: [], anchorA: [], anchorB: [], anchorT: [] };
  for (const ring of rings) {
    flat.contourStarts.push(flat.coords.length / 2);
    for (const v of ring) flat.coords.push(v);
    for (let i = 0; i < ring.length / 2; i++) {
      flat.anchorA.push(0);
      flat.anchorB.push(0);
      flat.anchorT.push(0);
    }
  }
  return flat;
};

describe('nestRings', () => {
  it('nests a ring on its container outline whose vertex rounds just outside the box', () => {
    const rings = nestRings(contours([0, 0, 10, 0, 10, 10, 0, 10], [0, 0, 10.000000000000002, 0, 10, 10, 0, 10]));
    expect(rings.map((r) => r.winding).sort()).toEqual([1, 2]);
  });

  it('keeps a ring just outside the box out', () => {
    const rings = nestRings(contours([0, 0, 10, 0, 10, 10, 0, 10], [11, 0, 12, 0, 12, 1]));
    expect(rings[1].parent).toBe(-1);
  });
});
