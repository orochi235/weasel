import { describe, it, expect } from 'vitest';
import Powerline from './Powerline';
import { BASES, type BadgeBase } from './index';

describe('Powerline base', () => {
  const W = 120;
  const H = 24;

  it('produces a closed bodyPath for flat-flat edges', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    expect(s.bodyPath.startsWith('M ')).toBe(true);
    expect(s.bodyPath.endsWith(' Z')).toBe(true);
  });

  it('totalCss is positive and finite', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    expect(s.totalCss).toBeGreaterThan(0);
    expect(Number.isFinite(s.totalCss)).toBe(true);
  });

  it('perimeterAt wraps around totalCss', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    const a = s.perimeterAt(0);
    const b = s.perimeterAt(s.totalCss);
    expect(a.x).toBeCloseTo(b.x, 3);
    expect(a.y).toBeCloseTo(b.y, 3);
  });

  it('flat-flat sampler returns x in [0,100] and y in [0,100] viewBox coords', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    for (let i = 0; i < 50; i++) {
      const p = s.perimeterAt((i / 50) * s.totalCss);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it('chevron right edge produces a body path containing the chevron tip past the rect right edge', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'chevron', depth: 6 }, W, H);
    const expectedTipVb = 100 + (6 / W) * 100;
    let maxX = 0;
    for (let i = 0; i < 80; i++) {
      const p = s.perimeterAt((i / 80) * s.totalCss);
      maxX = Math.max(maxX, p.x);
    }
    expect(maxX).toBeGreaterThan(99);
    expect(maxX).toBeLessThanOrEqual(expectedTipVb + 0.01);
    expect(maxX).toBeGreaterThan(expectedTipVb - 0.5);
  });

  it('insets are symmetric for flat-flat edges', () => {
    const insets = (Powerline.insets as Function)({ leftEdge: 'flat', rightEdge: 'flat', depth: 8 });
    expect(insets.left).toBe(8);
    expect(insets.right).toBe(8);
    expect(insets.top).toBe(0);
    expect(insets.bottom).toBe(0);
  });

  it('insets shift text rightward when the right cap protrudes outward', () => {
    // flat-left + chevron-right: chevron averages depth/2 outward, so visual
    // centroid sits right of the bounding box center. To re-center text in
    // the silhouette, padLeft must exceed padRight by avgLeft + avgRight = depth/2.
    const insets = (Powerline.insets as Function)({ leftEdge: 'flat', rightEdge: 'chevron', depth: 8 });
    expect(insets.left - insets.right).toBeCloseTo(4, 1);
    expect(insets.top).toBe(0);
    expect(insets.bottom).toBe(0);
  });

  it('insets reserve room when the left cap cuts inward into the body', () => {
    // The previous segment's chevron endCap means this segment's left edge
    // dips into the body by up to `depth` at t=0.5. Padding must keep text
    // clear of that notch.
    const insets = (Powerline.insets as Function)({ leftEdge: 'chevron', rightEdge: 'flat', depth: 8 });
    expect(insets.left).toBeGreaterThanOrEqual(8);
  });

  it('top corners follow the edge profiles when they are non-zero at t=0', () => {
    // slant-up returns `depth` at t=0, so the top-right corner should sit at
    // x = (boxW + depth) * sx and the top-left at x = depth * sx — not at the
    // unprotruded rect corners.
    const s = Powerline.build({ leftEdge: 'slant-up', rightEdge: 'slant-up', depth: 6 }, W, H);
    // Sample s=0 (start of perimeter = top-left corner).
    const start = s.perimeterAt(0);
    expect(start.x).toBeCloseTo((6 / W) * 100, 3);
    expect(start.y).toBeCloseTo(0, 3);
  });
});

describe('Powerline base registration', () => {
  it('is registered under the "powerline" key', () => {
    const key: BadgeBase = 'powerline';
    expect(BASES[key]).toBeDefined();
    expect(typeof BASES[key].build).toBe('function');
  });
});
