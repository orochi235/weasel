import { describe, expect, it } from 'vitest';
import {
  anchorCount, readAnchors, splineEvaluator, splineMode, withAnchor, withAnchorCount, withInsertedAnchor, withoutAnchor,
} from './splineAnchors';

describe('readAnchors', () => {
  it('reads the base defaults when no slot is set', () => {
    expect(readAnchors({})).toEqual([
      { s: 0, r: 48, w: 1 },
      { s: 0.25, r: 30, w: 1 },
      { s: 0.5, r: 32, w: 1 },
      { s: 0.75, r: 38, w: 1 },
      { s: 1, r: 46, w: 1 },
    ]);
  });

  it('pins the ends and clamps what lies between', () => {
    const anchors = readAnchors({ count: 3, s0: 0.4, s1: 1.5, s2: 0.2, r1: -5, w1: 9 });
    expect(anchors).toEqual([
      { s: 0, r: 48, w: 1 },
      { s: 1, r: 0, w: 3 },
      { s: 1, r: 32, w: 1 },
    ]);
  });

  it('holds the count between three and twelve', () => {
    expect(anchorCount({ count: 1 })).toBe(3);
    expect(anchorCount({ count: 40 })).toBe(12);
    expect(anchorCount({ count: 6.9 })).toBe(6);
    expect(anchorCount({})).toBe(5);
  });

  it('is an octant unless told quadrant', () => {
    expect(splineMode({})).toBe('octant');
    expect(splineMode({ mode: 'quadrant' })).toBe('quadrant');
  });
});

describe('withAnchorCount', () => {
  it('spreads the active anchors evenly and keeps every other param', () => {
    expect(withAnchorCount({ count: 5, s1: 0.1, r1: 20, rotation: 4 }, 3)).toEqual({
      count: 3, s0: 0, s1: 0.5, s2: 1, r1: 20, rotation: 4,
    });
  });
});

describe('withAnchor', () => {
  it('writes the three slots of one anchor', () => {
    expect(withAnchor({ count: 5 }, 2, { s: 0.4, r: 20, w: 2 })).toEqual({ count: 5, s2: 0.4, r2: 20, w2: 2 });
  });

  it('mirrors an end onto the other end in quadrant mode', () => {
    expect(withAnchor({ mode: 'quadrant', count: 4 }, 0, { s: 0, r: 20, w: 2 })).toEqual({
      mode: 'quadrant', count: 4, s0: 0, r0: 20, w0: 2, r3: 20, w3: 2,
    });
    expect(withAnchor({ mode: 'quadrant', count: 4 }, 3, { s: 1, r: 25, w: 0.5 })).toEqual({
      mode: 'quadrant', count: 4, s3: 1, r3: 25, w3: 0.5, r0: 25, w0: 0.5,
    });
  });

  it('leaves the other end alone in octant mode', () => {
    expect(withAnchor({ count: 4 }, 0, { s: 0, r: 20, w: 2 })).toEqual({ count: 4, s0: 0, r0: 20, w0: 2 });
  });
});

describe('withoutAnchor', () => {
  it('closes the gap and drops the count', () => {
    expect(withoutAnchor({}, 2)).toEqual({
      s2: 0.75, r2: 38, w2: 1,
      s3: 1, r3: 46, w3: 1,
      count: 4,
    });
  });

  it('refuses an end, and refuses to go below three', () => {
    const five = { count: 5 };
    expect(withoutAnchor(five, 0)).toBe(five);
    expect(withoutAnchor(five, 4)).toBe(five);
    const three = { count: 3 };
    expect(withoutAnchor(three, 1)).toBe(three);
  });
});

describe('withInsertedAnchor', () => {
  it('opens a slot where the new position falls and shifts the rest up', () => {
    expect(withInsertedAnchor({}, 0.6, 20)).toEqual({
      s3: 0.6, r3: 20, w3: 1,
      s4: 0.75, r4: 38, w4: 1,
      s5: 1, r5: 46, w5: 1,
      count: 6,
    });
  });

  it('keeps a hundredth clear of each neighbor', () => {
    expect(withInsertedAnchor({}, 0.2505, 20).s2).toBe(0.26);
    expect(withInsertedAnchor({}, 0.4999, 20).s2).toBe(0.49);
  });

  it('refuses when the neighbors leave no room or the curve is full', () => {
    const tight = { s1: 0.5, s2: 0.505 };
    expect(withInsertedAnchor(tight, 0.502, 20)).toBe(tight);
    const full = { count: 12 };
    expect(withInsertedAnchor(full, 0.5, 20)).toBe(full);
  });
});

describe('splineEvaluator', () => {
  const flat = [{ s: 0, r: 30, w: 1 }, { s: 0.5, r: 30, w: 1 }, { s: 1, r: 30, w: 1 }];
  const bent = [{ s: 0, r: 48, w: 1 }, { s: 0.5, r: 20, w: 1 }, { s: 1, r: 40, w: 1 }];

  it('draws a flat curve through anchors of one radius, in either base', () => {
    for (const base of ['octant-spline', 'octant-bspline'] as const) {
      const r = splineEvaluator(base, flat);
      for (const s of [0, 0.2, 0.5, 0.9, 1]) expect(r(s)).toBeCloseTo(30, 9);
    }
  });

  it('passes the interpolating spline through every anchor', () => {
    const r = splineEvaluator('octant-spline', bent);
    expect(r(0)).toBe(48);
    expect(r(0.5)).toBe(20);
    expect(r(1)).toBe(40);
  });

  it('pulls the approximating spline toward an interior anchor without reaching it', () => {
    const r = splineEvaluator('octant-bspline', bent);
    expect(r(0.5)).toBeGreaterThan(20);
    expect(r(0.5)).toBeLessThan(48);
  });
});
