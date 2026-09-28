import { describe, it, expect } from 'vitest';
import { deriveParallaxView, planeMap, toPlane, fromPlane, rectFromPlane, rectToPlane } from './parallax';
import type { View } from './view';

const outer: View = { x: 100, y: 50, scale: { x: 2, y: 2 } };

describe('deriveParallaxView', () => {
  it('is identity when pan=1, zoom=1', () => {
    const inner = deriveParallaxView(outer, { pan: 1, zoom: 1 });
    expect(inner).toEqual(outer);
  });

  it('defaults zoom to 1 when omitted', () => {
    const inner = deriveParallaxView(outer, { pan: 1 });
    expect(inner.scale).toEqual({ x: 2, y: 2 });
  });

  it('locks pan to anchor when pan=0', () => {
    const inner = deriveParallaxView(outer, { pan: 0 });
    expect(inner.x).toBe(0);
    expect(inner.y).toBe(0);
  });

  it('locks scale to identity when zoom=0', () => {
    const inner = deriveParallaxView(outer, { pan: 1, zoom: 0 });
    expect(inner.scale).toEqual({ x: 1, y: 1 });
  });

  it('lags pan by factor (anchor at origin)', () => {
    const inner = deriveParallaxView(outer, { pan: 0.5 });
    expect(inner.x).toBe(50);
    expect(inner.y).toBe(25);
  });

  it('respects non-origin anchor for pan', () => {
    const inner = deriveParallaxView(outer, {
      pan: 0.5,
      anchor: { x: 100, y: 50 },
    });
    expect(inner.x).toBe(100);
    expect(inner.y).toBe(50);
  });

  it('treats scalar pan as uniform x/y', () => {
    const scalar = deriveParallaxView(outer, { pan: 0.5 });
    const vector = deriveParallaxView(outer, { pan: { x: 0.5, y: 0.5 } });
    expect(scalar).toEqual(vector);
  });

  it('treats scalar zoom as uniform x/y', () => {
    const scalar = deriveParallaxView(outer, { pan: 1, zoom: 0.5 });
    const vector = deriveParallaxView(outer, { pan: 1, zoom: { x: 0.5, y: 0.5 } });
    expect(scalar).toEqual(vector);
  });

  it('supports per-axis pan split', () => {
    const inner = deriveParallaxView(outer, { pan: { x: 0.5, y: 1 } });
    expect(inner.x).toBe(50);
    expect(inner.y).toBe(50);
  });

  it('linearly interpolates zoom from identity', () => {
    const inner = deriveParallaxView(outer, { pan: 1, zoom: 0.5 });
    expect(inner.scale).toEqual({ x: 1.5, y: 1.5 });
  });
});

const screenOf = (v: View, p: { x: number; y: number }) => ({
  x: (p.x - v.x) * v.scale.x,
  y: (p.y - v.y) * v.scale.y,
});

describe('planeMap', () => {
  const opts = { pan: { x: 0.3, y: 0.8 }, zoom: 0.5, anchor: { x: 40, y: -10 } };

  it('lands a camera-world point where the plane paints the same pixel', () => {
    const m = planeMap(outer, opts);
    const inner = deriveParallaxView(outer, opts);
    for (const w of [{ x: 0, y: 0 }, { x: 123, y: -45 }, { x: -300, y: 900 }]) {
      const s = screenOf(outer, w);
      const t = screenOf(inner, toPlane(m, w));
      expect(t.x).toBeCloseTo(s.x, 9);
      expect(t.y).toBeCloseTo(s.y, 9);
    }
  });

  it('is the identity for a plane locked to the scene', () => {
    const m = planeMap(outer, { pan: 1 });
    expect(toPlane(m, { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
  });

  it('round-trips points and rects', () => {
    const m = planeMap(outer, opts);
    const p = fromPlane(m, toPlane(m, { x: 12, y: 34 }));
    expect(p.x).toBeCloseTo(12, 9);
    expect(p.y).toBeCloseTo(34, 9);
    const r = { x: 10, y: 20, width: 30, height: 40 };
    const back = rectFromPlane(m, rectToPlane(m, r));
    expect(back.x).toBeCloseTo(10, 9);
    expect(back.width).toBeCloseTo(30, 9);
  });

  it('keeps a rect upright under a flipped axis', () => {
    const flipped: View = { x: 0, y: 0, scale: { x: 1, y: -2 } };
    const m = planeMap(flipped, { pan: 1, zoom: 0 });
    const r = rectFromPlane(m, { x: 0, y: 0, width: 10, height: 10 });
    expect(r.height).toBeGreaterThan(0);
  });
});
