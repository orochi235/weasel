import { describe, expect, it } from 'vitest';
import { DEFAULT_SYMMETRY, mirrorAcross, symmetryTransforms } from './kinds';

describe('the kinds, shrunk', () => {
  it('mirrors across an axis near the double range, which doubled past it and drew NaN', () => {
    const m = mirrorAcross({ x: 0, y: 0 }, -8.98846567431158e307);
    expect(m.every(Number.isFinite)).toBe(true);
    const r = (-8.98846567431158e307 % Math.PI) * 2;
    expect(m[0]).toBeCloseTo(Math.cos(r), 12);
  });

  it("draws no copy of a repeat its spacing carries past the double range, where it drew one at NaN", () => {
    const ms = symmetryTransforms({ ...DEFAULT_SYMMETRY, kind: 'repeat', angle: Math.PI / 2, spacing: Infinity, count: 3 }, { x: 0, y: 0 });
    expect(ms).toEqual([]);
  });

  it('draws no copy of a mirror whose axis is NaN, where it drew one made of NaN', () => {
    expect(symmetryTransforms({ ...DEFAULT_SYMMETRY, angle: Number.NaN }, { x: 0, y: 0 })).toEqual([]);
  });
});
