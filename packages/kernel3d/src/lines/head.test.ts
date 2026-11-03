import { describe, expect, it } from 'vitest';
import { HEAD, HEAD_OVERDRAW, headFor, layoutLine } from './head';

describe('headFor', () => {
  it('gives a long line the head its shaft asks for', () => {
    expect(headFor(2, 400)).toEqual(headFor(2));
    expect(headFor(2)).toEqual({ headLen: 16, headHalf: 7, shaftHalf: 2 });
  });

  it('carries a wider shaft a head in proportion', () => {
    const wide = headFor(6);
    expect(wide.headLen).toBeCloseTo(48);
    expect(wide.headHalf).toBeCloseTo(21);
    expect(wide.headHalf).toBeGreaterThan(wide.shaftHalf);
  });

  it('caps the head at its share of a short line, and never past it', () => {
    const { headLen } = headFor(12, 60);
    expect(12 * HEAD.lenRatio).toBeGreaterThan(60);
    expect(headLen).toBeCloseTo(60 * HEAD.maxShare);
  });

  it('shortens a capped head without reshaping it', () => {
    for (const line of [40, 80, 160, 1000]) {
      const { headHalf, headLen } = headFor(12, line);
      expect(headHalf / headLen).toBeCloseTo(HEAD.aspect);
    }
  });

  it('narrows the shaft by the share the cap took', () => {
    const full = headFor(12);
    const capped = headFor(12, 60);
    expect(capped.shaftHalf / 12).toBeCloseTo(capped.headLen / full.headLen);
  });

  it('never lets the shaft outgrow the head it carries', () => {
    const blunt = { lenRatio: 1, maxShare: 0.5, aspect: 0.25 };
    const s = headFor(8, Number.POSITIVE_INFINITY, blunt);
    expect(s.shaftHalf).toBeLessThanOrEqual(s.headHalf);
  });
});

describe('layoutLine', () => {
  it('stops the shaft under the head, by all but its overdraw', () => {
    // 100 units at 2 px a unit: a 200 px line with the default 16 px head, 8 units long.
    const l = layoutLine(2, 100, 2, HEAD);
    expect(l.headLen).toBeCloseTo(16);
    expect(l.shaftEnd).toBeCloseTo(100 - 8 * (1 - HEAD_OVERDRAW));
  });

  it('runs a headless line to its end at full width', () => {
    expect(layoutLine(3, 50, 2, null)).toEqual({ headLen: 0, headHalf: 0, shaftHalf: 3, shaftEnd: 50 });
  });

  it('draws no head where the scale on screen is unknown', () => {
    expect(layoutLine(3, 50, 0, HEAD).shaftEnd).toBe(50);
    expect(layoutLine(3, 50, Number.NaN, HEAD).headLen).toBe(0);
  });

  it('caps against the whole line, however it is cut into segments', () => {
    // 30 units at 2 px a unit is 60 px of line, so the 48 px a 6 px shaft asks for is cut to 30.
    expect(layoutLine(6, 30, 2, HEAD).headLen).toBeCloseTo(30);
  });
});
