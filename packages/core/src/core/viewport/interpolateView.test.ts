import { describe, it, expect } from 'vitest';
import { interpolateView } from './interpolateView';
import { zoomAt } from './zoomAt';
import type { View } from './view';

const V = (x: number, y: number, s: number): View => ({ x, y, scale: { x: s, y: s } });

/** The world point drawn at a canvas-local screen point (see `view.ts`). */
const worldAt = (v: View, p: { x: number; y: number }) => ({
  x: p.x / v.scale.x + v.x,
  y: p.y / v.scale.y + v.y,
});

const expectViewCloseTo = (a: View, b: View, digits = 10) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
  expect(a.scale.x).toBeCloseTo(b.scale.x, digits);
  expect(a.scale.y).toBeCloseTo(b.scale.y, digits);
};

describe('interpolateView', () => {
  it('lands on the endpoints at t=0 and t=1', () => {
    const from = V(10, 20, 1);
    const to = zoomAt(from, { x: 240, y: 160 }, 4);
    const f = interpolateView(from, to);
    expectViewCloseTo(f(0), from);
    expectViewCloseTo(f(1), to);
  });

  it('interpolates scale geometrically, not linearly', () => {
    const from = V(0, 0, 1);
    const to = zoomAt(from, { x: 240, y: 160 }, 8);
    const mid = interpolateView(from, to)(0.5);
    // sqrt(1 * 8) = 2.828…; a linear lerp would put this at 4.5.
    expect(mid.scale.x).toBeCloseTo(Math.sqrt(8), 10);
    expect(mid.scale.y).toBeCloseTo(Math.sqrt(8), 10);
  });

  it('holds the zoom anchor under the same screen pixel for the whole tween', () => {
    const anchor = { x: 240, y: 160 };
    const from = V(10, 20, 1.5);
    const to = zoomAt(from, anchor, 3);
    const f = interpolateView(from, to);
    const w = worldAt(from, anchor);
    for (const t of [0, 0.13, 0.5, 0.77, 1]) {
      const at = worldAt(f(t), anchor);
      expect(at.x).toBeCloseTo(w.x, 9);
      expect(at.y).toBeCloseTo(w.y, 9);
    }
  });

  it('lerps translation linearly when the scale does not change', () => {
    const from = V(0, 0, 2);
    const to = V(100, 40, 2);
    expect(interpolateView(from, to)(0.25)).toEqual({ x: 25, y: 10, scale: { x: 2, y: 2 } });
  });

  it('keeps scale positive when an easing overshoots past 1', () => {
    const from = V(0, 0, 1);
    const to = zoomAt(from, { x: 100, y: 100 }, 2);
    expect(interpolateView(from, to)(1.35).scale.x).toBeCloseTo(Math.pow(2, 1.35), 10);
  });

  it('interpolates the two axes independently', () => {
    const from: View = { x: 0, y: 0, scale: { x: 1, y: 4 } };
    const to: View = { x: 0, y: 0, scale: { x: 9, y: 4 } };
    const mid = interpolateView(from, to)(0.5);
    expect(mid.scale.x).toBeCloseTo(3, 10);
    expect(mid.scale.y).toBeCloseTo(4, 10);
  });
});
