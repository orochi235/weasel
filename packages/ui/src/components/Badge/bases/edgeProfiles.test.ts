import { describe, it, expect } from 'vitest';
import { EDGE_PROFILES, puzzleEdge, resolveEdge, type EdgePoint, type EdgeProfile } from './edgeProfiles';

describe('EDGE_PROFILES', () => {
  it('flat returns 0 for all t', () => {
    expect(EDGE_PROFILES.flat(0, 6)).toBe(0);
    expect(EDGE_PROFILES.flat(0.5, 6)).toBe(0);
    expect(EDGE_PROFILES.flat(1, 6)).toBe(0);
  });

  it('chevron peaks at t=0.5 and is zero at endpoints', () => {
    expect(EDGE_PROFILES.chevron(0, 10)).toBeCloseTo(0);
    expect(EDGE_PROFILES.chevron(0.5, 10)).toBeCloseTo(10);
    expect(EDGE_PROFILES.chevron(1, 10)).toBeCloseTo(0);
  });

  it('slant rises linearly from 0 at t=0 to depth at t=1', () => {
    expect(EDGE_PROFILES.slant(0, 8)).toBeCloseTo(0);
    expect(EDGE_PROFILES.slant(0.5, 8)).toBeCloseTo(4);
    expect(EDGE_PROFILES.slant(1, 8)).toBeCloseTo(8);
  });

  it('slant-up is the mirror of slant', () => {
    expect(EDGE_PROFILES['slant-up'](0, 8)).toBeCloseTo(8);
    expect(EDGE_PROFILES['slant-up'](1, 8)).toBeCloseTo(0);
  });

  it('round is zero at endpoints and depth at midpoint', () => {
    expect(EDGE_PROFILES.round(0, 6)).toBeCloseTo(0);
    expect(EDGE_PROFILES.round(0.5, 6)).toBeCloseTo(6);
    expect(EDGE_PROFILES.round(1, 6)).toBeCloseTo(0);
  });

  it('concave-chevron is the negation of chevron', () => {
    expect(EDGE_PROFILES['concave-chevron'](0.5, 10)).toBeCloseTo(-10);
  });

  it('scallop oscillates and is bounded by 0.4 * depth', () => {
    for (let i = 0; i <= 10; i++) {
      const v = EDGE_PROFILES.scallop(i / 10, 10);
      expect(Math.abs(v)).toBeLessThanOrEqual(10 * 0.4 + 1e-9);
    }
  });
});

describe('resolveEdge', () => {
  it('samples a named profile top to bottom in CSS px', () => {
    const pts = resolveEdge('chevron')(10, 40);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: 40 });
    const mid = pts[(pts.length - 1) / 2];
    expect(mid.y).toBeCloseTo(20);
    expect(mid.x).toBeCloseTo(10);
  });

  it('samples a custom profile function', () => {
    const custom: EdgeProfile = (t, d) => t * d * 2;
    const pts = resolveEdge(custom)(3, 10);
    expect(pts[pts.length - 1]).toEqual({ x: 6, y: 10 });
  });

  it('resolves puzzle to the puzzle path', () => {
    expect(resolveEdge('puzzle')).toBe(puzzleEdge);
  });

  it('falls back to flat for an unknown name', () => {
    // @ts-expect-error intentional bad name
    const pts = resolveEdge('bogus')(6, 20);
    expect(pts.every((p) => p.x === 0)).toBe(true);
  });
});

describe('puzzle edge', () => {
  const H = 20;
  const D = 6;
  const r = D / 2;
  const yc = H / 2;
  const pts = puzzleEdge(D, H);
  const dist = (a: EdgePoint, b: EdgePoint) => Math.hypot(a.x - b.x, a.y - b.y);

  it('runs from the top of the edge to the bottom', () => {
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: H });
  });

  it('leaves the edge exactly one bulb radius either side of center', () => {
    const onEdge = pts.filter((p) => p.x === 0).map((p) => p.y);
    expect(onEdge).toEqual([0, yc - r, yc + r, H]);
  });

  it('protrudes by the full depth at the center', () => {
    const tip = pts.reduce((a, b) => (b.x > a.x ? b : a));
    expect(tip.x).toBeCloseTo(D, 9);
    expect(tip.y).toBeCloseTo(yc, 9);
  });

  it('draws a continuous curve: no step between samples is a jump', () => {
    const steps = pts.slice(1).map((p, i) => dist(pts[i], p));
    const curved = steps.filter((_, i) => pts[i].x !== 0 || pts[i + 1].x !== 0);
    expect(Math.max(...curved)).toBeLessThan(r * 0.2);
  });

  it('overhangs its neck: the bulb reaches above the narrowest neck point', () => {
    const upper = pts.filter((p) => p.y < yc && p.x > 0);
    const bulbTop = Math.min(...upper.map((p) => p.y));
    const neckTop = Math.max(...upper.filter((p) => p.x < r).map((p) => p.y));
    expect(bulbTop).toBeCloseTo(yc - r, 3);
    expect(neckTop).toBeGreaterThan(bulbTop + r * 0.2);
  });

  it('is symmetric about the center line', () => {
    for (let i = 0; i < pts.length; i++) {
      const m = pts[pts.length - 1 - i];
      expect(m.x).toBeCloseTo(pts[i].x, 9);
      expect(m.y).toBeCloseTo(H - pts[i].y, 9);
    }
  });

  it('shrinks to fit a short edge rather than overrunning it', () => {
    const short = puzzleEdge(20, 10);
    const ys = short.map((p) => p.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(10);
    const span = short.filter((p) => p.x > 0).map((p) => p.y);
    expect(Math.max(...span) - Math.min(...span)).toBeLessThanOrEqual(10 * 0.7 + 1e-9);
  });

  it('points the other way for a negative depth', () => {
    const inward = puzzleEdge(-D, H);
    inward.forEach((p, i) => expect(p.x).toBeCloseTo(-pts[i].x, 12));
  });
});
