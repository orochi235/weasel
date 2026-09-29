import { describe, it, expect } from 'vitest';
import { composePatternTransform } from '@weasel-js/paint';
import { mat3 } from './mat3';
import { patternTileSpace } from './patternSpace';

describe('patternTileSpace', () => {
  it('only subtracts the origin when there is no transform', () => {
    const m = patternTileSpace(mat3.identity(), { x: 10, y: -4 }, undefined)!;
    expect(mat3.apply(m, 13, 1)).toEqual([3, 5]);
  });

  it('takes a paint-space point back to the tile point the transform sent there', () => {
    const t = composePatternTransform({ rotation: 0.6, scaleX: 2, scaleY: 0.5, skewX: 0.3 });
    const origin = { x: 7, y: 3 };
    const m = patternTileSpace(mat3.identity(), origin, t)!;
    const [u, v] = [4, -9];
    const px = origin.x + t[0] * u + t[2] * v;
    const py = origin.y + t[1] * u + t[3] * v;
    const [bu, bv] = mat3.apply(m, px, py);
    expect(bu).toBeCloseTo(u, 4);
    expect(bv).toBeCloseTo(v, 4);
  });

  it('applies the space inverse first, so screen positions reach the tile', () => {
    // Screen is paint space scaled by 2: the inverse halves, then the tile's
    // 90° turn takes paint-space +y back to tile +x.
    const spaceInverse = mat3.fromAffine([0.5, 0, 0, 0.5, 0, 0]);
    const m = patternTileSpace(spaceInverse, { x: 0, y: 0 }, composePatternTransform({ rotation: Math.PI / 2 }))!;
    const [u, v] = mat3.apply(m, 0, 20);
    expect(u).toBeCloseTo(10, 5);
    expect(v).toBeCloseTo(0, 5);
  });

  it('is null for a transform that collapses the tile', () => {
    expect(patternTileSpace(mat3.identity(), { x: 0, y: 0 }, [1, 2, 2, 4])).toBeNull();
  });
});
