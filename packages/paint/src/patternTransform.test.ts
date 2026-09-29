import { describe, it, expect } from 'vitest';
import {
  composePatternTransform,
  decomposePatternTransform,
  type PatternTransform,
} from './patternTransform';

function close(a: PatternTransform, b: readonly number[]): void {
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
}

describe('composePatternTransform', () => {
  it('is the identity with no parts', () => {
    close(composePatternTransform({}), [1, 0, 0, 1]);
  });

  it('writes a rotation in SVG matrix() order', () => {
    const t = Math.PI / 6;
    close(composePatternTransform({ rotation: t }), [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t)]);
  });

  it('writes a skewX as SVG skewX() does', () => {
    close(composePatternTransform({ skewX: Math.PI / 4 }), [1, 0, 1, 1]);
  });

  it('scales before it skews, and skews before it rotates', () => {
    // R(90°) · K(45°) · S(2, 3): S takes (1, 0) to (2, 0) and (0, 1) to (0, 3);
    // K leaves the first alone and shears the second to (3, 3); R turns both.
    close(
      composePatternTransform({ rotation: Math.PI / 2, skewX: Math.PI / 4, scaleX: 2, scaleY: 3 }),
      [0, 2, -3, 3],
    );
  });
});

describe('decomposePatternTransform', () => {
  it.each([
    { rotation: 0, scaleX: 1, scaleY: 1, skewX: 0 },
    { rotation: 0.7, scaleX: 1, scaleY: 1, skewX: 0 },
    { rotation: -2.1, scaleX: 2, scaleY: 0.5, skewX: 0.3 },
    { rotation: 1.2, scaleX: 1.5, scaleY: -1, skewX: -0.4 },
  ])('recovers the parts it was composed from: %o', (parts) => {
    const back = decomposePatternTransform(composePatternTransform(parts));
    expect(back.rotation).toBeCloseTo(parts.rotation, 9);
    expect(back.scaleX).toBeCloseTo(parts.scaleX, 9);
    expect(back.scaleY).toBeCloseTo(parts.scaleY, 9);
    expect(back.skewX).toBeCloseTo(parts.skewX, 9);
  });

  it('reads an absent transform as the identity', () => {
    expect(decomposePatternTransform(undefined)).toEqual({ rotation: 0, scaleX: 1, scaleY: 1, skewX: 0 });
  });

  it('reads a degenerate first column as unrotated rather than NaN', () => {
    const parts = decomposePatternTransform([0, 0, 0, 1]);
    expect(parts.rotation).toBe(0);
    expect(parts.scaleX).toBe(0);
    expect(Number.isFinite(parts.skewX)).toBe(true);
  });
});
