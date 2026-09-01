import { describe, it, expect } from 'vitest';
import { clampView } from './clampView';

const BOUNDS = { x: 0, y: 0, width: 1000, height: 800 };
const CANVAS = { width: 400, height: 300 };

describe('clampView', () => {
  it('returns the input identity when already inside bounds', () => {
    const v = { x: 100, y: 100, scale: { x: 1, y: 1 } };
    expect(clampView(v, BOUNDS, CANVAS)).toBe(v);
  });

  it('clamps left edge to bounds.x', () => {
    const v = { x: -50, y: 100, scale: { x: 1, y: 1 } };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 0, y: 100, scale: { x: 1, y: 1 } });
  });

  it('clamps right edge so visible rect stays inside bounds', () => {
    const v = { x: 9999, y: 100, scale: { x: 1, y: 1 } };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 600, y: 100, scale: { x: 1, y: 1 } });
  });

  it('clamps top edge to bounds.y', () => {
    const v = { x: 100, y: -50, scale: { x: 1, y: 1 } };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 100, y: 0, scale: { x: 1, y: 1 } });
  });

  it('clamps bottom edge', () => {
    const v = { x: 100, y: 9999, scale: { x: 1, y: 1 } };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 100, y: 500, scale: { x: 1, y: 1 } });
  });

  it('respects scale (visible rect = canvas/scale)', () => {
    // scale=2 → visible = 200×150. maxX = 1000 - 200 = 800.
    const v = { x: 9999, y: 100, scale: { x: 2, y: 2 } };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 800, y: 100, scale: { x: 2, y: 2 } });
  });

  it('centers axis when zoomed out past bounds extent', () => {
    // scale=0.25 → visible = 1600×1200. Wider than 1000 → centered.
    const v = { x: 9999, y: 9999, scale: { x: 0.25, y: 0.25 } };
    // x: 0 + (1000 - 1600) / 2 = -300; y: 0 + (800 - 1200) / 2 = -200
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: -300, y: -200, scale: { x: 0.25, y: 0.25 } });
  });

  it('honors non-zero bounds origin', () => {
    const bounds = { x: 100, y: 50, width: 1000, height: 800 };
    const v = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    expect(clampView(v, bounds, CANVAS)).toEqual({ x: 100, y: 50, scale: { x: 1, y: 1 } });
  });

  it('uses per-axis visible rect when scale axes differ', () => {
    // canvas 100x100, scale {x: 1, y: 2} -> visible world rect 100x50
    const view = { x: -10, y: -10, scale: { x: 1, y: 2 } };
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    const canvas = { width: 100, height: 100 };
    const clamped = clampView(view, bounds, canvas);
    expect(clamped.x).toBe(0); // hit left edge (visW=100 < 200)
    expect(clamped.y).toBe(0); // hit top edge (visH=50 < 200)
  });
});

describe('clampView on an axis with negative scale', () => {
  // A y-up view shows [view.y + canvas.height / scale.y, view.y] — the visible
  // rect runs *up* from the anchor, so both the extent test and the interval
  // have to read the magnitude.
  const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
  const canvas = { width: 200, height: 200 };

  it('treats the visible extent as a magnitude, not a signed height', () => {
    // scale.y -2 shows 100 world units, well inside the 1000 of bounds, so
    // this must clamp against the edges rather than centre as if zoomed out.
    const view = { x: 0, y: 500, scale: { x: 2, y: -2 } };
    expect(clampView(view, bounds, canvas).y).toBe(500);
  });

  it('holds the visible rect inside bounds at the top edge', () => {
    const view = { x: 0, y: 5000, scale: { x: 2, y: -2 } };
    const out = clampView(view, bounds, canvas);
    expect(out.y).toBe(bounds.y + bounds.height);
  });

  it('holds the visible rect inside bounds at the bottom edge', () => {
    const view = { x: 0, y: -5000, scale: { x: 2, y: -2 } };
    const out = clampView(view, bounds, canvas);
    expect(out.y).toBe(bounds.y + 100);
  });
});
