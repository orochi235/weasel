import { describe, expect, it } from 'vitest';
import { fracContains, fracIntersects, fracToWorld, roundFrac, worldToFrac } from './frac';
import type { FracRect } from './types';

const CONTENT = { w: 256, h: 170 };

describe('fraction ↔ world', () => {
  it('scales a fraction onto the content box', () => {
    expect(fracToWorld({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, CONTENT)).toEqual({
      x: 64,
      y: 85,
      width: 128,
      height: 42.5,
    });
  });

  it('round-trips', () => {
    const f: FracRect = { x: 0.3322, y: 0.3581, w: 0.02, h: 0.0861 };
    expect(roundFrac(worldToFrac(fracToWorld(f, CONTENT), CONTENT))).toEqual(f);
  });

  it('gives zeros, not NaN, for a content box with a zero side', () => {
    // A pane measured before layout is 0×0. NaN here would propagate silently
    // through every later comparison — a stale mark would neither hit-test nor
    // report itself as broken.
    const got = worldToFrac({ x: 10, y: 10, width: 5, height: 5 }, { w: 0, h: 0 });
    expect(got).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    for (const v of Object.values(got)) expect(Number.isFinite(v)).toBe(true);
  });

  it('rounds to 4dp, so a stored diff shows meaning and not float noise', () => {
    expect(roundFrac({ x: 0.333333333, y: 0.1, w: 0.66666666, h: 0.2 })).toEqual({
      x: 0.3333,
      y: 0.1,
      w: 0.6667,
      h: 0.2,
    });
  });
});

describe('fraction hit geometry', () => {
  const box: FracRect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };

  it('contains a point inside and rejects one outside', () => {
    expect(fracContains(box, { x: 0.3, y: 0.3 })).toBe(true);
    expect(fracContains(box, { x: 0.9, y: 0.3 })).toBe(false);
  });

  it('widens the hit by the tolerance', () => {
    expect(fracContains(box, { x: 0.18, y: 0.3 })).toBe(false);
    expect(fracContains(box, { x: 0.18, y: 0.3 }, 0.05)).toBe(true);
  });

  it('intersects only a box that wholly contains it', () => {
    expect(fracIntersects({ x: 0, y: 0, w: 1, h: 1 }, box)).toBe(true);
    // Overlapping is not containing: a marquee takes what it encloses.
    expect(fracIntersects({ x: 0.4, y: 0.4, w: 0.4, h: 0.4 }, box)).toBe(false);
  });
});
