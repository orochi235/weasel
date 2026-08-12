import { describe, it, expect } from 'vitest';
import { pxExtent, scaleDelta, withinPxBox, withinPxRadius } from './pxExtent';
import { meanScale } from './meanScale';

const UNIFORM = { x: 2, y: 2 };
/** 4:1 anisotropy — wide enough that the meanScale error is unmistakable. */
const SQUISHED = { x: 4, y: 1 };

describe('pxExtent', () => {
  it('divides each axis by its own scale', () => {
    expect(pxExtent(8, SQUISHED)).toEqual({ x: 2, y: 8 });
  });

  it('agrees with meanScale under uniform zoom', () => {
    const e = pxExtent(8, UNIFORM);
    expect(e.x).toBeCloseTo(8 / meanScale(UNIFORM));
    expect(e.y).toBeCloseTo(8 / meanScale(UNIFORM));
  });

  it('uses magnitude, so a flipped axis keeps a positive extent', () => {
    expect(pxExtent(8, { x: -4, y: 1 })).toEqual({ x: 2, y: 8 });
  });

  it('does not blow up on a zero axis', () => {
    expect(Number.isFinite(pxExtent(8, { x: 0, y: 1 }).x)).toBe(true);
  });
});

describe('withinPxBox', () => {
  it('is a true square on screen, not in world', () => {
    // 8px half-extent at scale (4, 1): 2 world units across, 8 world units down.
    expect(withinPxBox(2, 0, 8, SQUISHED)).toBe(true);
    expect(withinPxBox(2.01, 0, 8, SQUISHED)).toBe(false);
    expect(withinPxBox(0, 8, 8, SQUISHED)).toBe(true);
    expect(withinPxBox(0, 8.01, 8, SQUISHED)).toBe(false);
  });

  it('accepts the corner, which a radial test would reject', () => {
    expect(withinPxBox(2, 8, 8, SQUISHED)).toBe(true);
    expect(withinPxRadius(2, 8, 8, SQUISHED)).toBe(false);
  });

  it('is symmetric in sign', () => {
    expect(withinPxBox(-2, -8, 8, SQUISHED)).toBe(true);
  });

  it('reproduces the meanScale answer under uniform zoom', () => {
    const world = 8 / meanScale(UNIFORM);
    expect(withinPxBox(world, world, 8, UNIFORM)).toBe(true);
    expect(withinPxBox(world * 1.01, 0, 8, UNIFORM)).toBe(false);
  });

  it('is what meanScale gets wrong: a point meanScale accepts on the tight axis', () => {
    // meanScale(4, 1) = 2, so the old test allowed |dx| <= 4 world units.
    // At scale.x = 4 that is 16 screen px — twice the declared 8.
    const oldWorldExtent = 8 / meanScale(SQUISHED);
    expect(oldWorldExtent).toBeCloseTo(4);
    expect(withinPxBox(3, 0, 8, SQUISHED)).toBe(false);
  });

  it('and a point meanScale rejects on the loose axis', () => {
    // Same view, other axis: 5 world units down is 5 screen px, inside an
    // 8px handle, but outside the old 4-world-unit square.
    expect(withinPxBox(0, 5, 8, SQUISHED)).toBe(true);
  });
});

describe('withinPxRadius', () => {
  it('is a true circle on screen', () => {
    expect(withinPxRadius(2, 0, 8, SQUISHED)).toBe(true);
    expect(withinPxRadius(2.01, 0, 8, SQUISHED)).toBe(false);
    expect(withinPxRadius(0, 8, 8, SQUISHED)).toBe(true);
  });

  it('accepts a 3-4-5 triangle at the boundary', () => {
    // (dx, dy) scaled to (6, 8) screen px → radius 10.
    expect(withinPxRadius(1.5, 8, 10, SQUISHED)).toBe(true);
    expect(withinPxRadius(1.5, 8, 9.99, SQUISHED)).toBe(false);
  });
});

describe('scaleDelta', () => {
  it('maps a world delta to screen with no translation term', () => {
    expect(scaleDelta(3, 5, SQUISHED)).toEqual({ x: 12, y: 5 });
  });
});
