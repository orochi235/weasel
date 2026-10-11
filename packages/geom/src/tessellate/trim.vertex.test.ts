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
});
