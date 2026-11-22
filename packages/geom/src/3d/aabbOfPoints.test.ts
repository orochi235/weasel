import { describe, expect, it } from 'vitest';
import { aabbOfPoints } from './ray3';

describe('aabbOfPoints with NaN', () => {
  it('skips a NaN coordinate', () => {
    expect(aabbOfPoints([{ x: NaN, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }])).toEqual({
      min: { x: 1, y: 0, z: 0 },
      max: { x: 1, y: 1, z: 1 },
    });
  });

  it('answers null when an axis has no number', () => {
    expect(aabbOfPoints([{ x: NaN, y: NaN, z: NaN }])).toBeNull();
    expect(aabbOfPoints([{ x: 1, y: NaN, z: 1 }])).toBeNull();
  });
});
