import { describe, expect, it } from 'vitest';
import { trimPolyline } from './trim';

describe('trimPolyline at a vertex', () => {
  const bent = { points: [0, 0, 10, 0, 10, 10], closed: false };

  it('starts at the vertex once when the start inset lands on it', () => {
    expect(trimPolyline(bent, 10, 0)!.points).toEqual([10, 0, 10, 10]);
  });

  it('ends at the vertex once when the end inset lands on it', () => {
    expect(trimPolyline(bent, 0, 10)!.points).toEqual([0, 0, 10, 0]);
  });

  // A cut a float's rounding past a vertex left a sliver segment whose direction is noise,
  // which skewed a butt end and a head's angle.
  it('ends at the vertex when the end cut lands within float rounding of it', () => {
    expect(trimPolyline(bent, 0, 10 - 1e-6)!.points).toEqual([0, 0, 10, 0]);
  });

  it('starts at the vertex when the start cut lands within float rounding of it', () => {
    expect(trimPolyline(bent, 10 - 1e-6, 0)!.points).toEqual([10, 0, 10, 10]);
  });

  it('keeps a cut a real distance from the vertex', () => {
    expect(trimPolyline(bent, 0, 10 - 1e-3)!.points).toHaveLength(6);
  });
});
