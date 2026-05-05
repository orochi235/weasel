import { describe, it, expect } from 'vitest';
import { clampView } from './clampView';

const BOUNDS = { x: 0, y: 0, width: 1000, height: 800 };
const CANVAS = { width: 400, height: 300 };

describe('clampView', () => {
  it('returns the input identity when already inside bounds', () => {
    const v = { x: 100, y: 100, scale: 1 };
    expect(clampView(v, BOUNDS, CANVAS)).toBe(v);
  });

  it('clamps left edge to bounds.x', () => {
    const v = { x: -50, y: 100, scale: 1 };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 0, y: 100, scale: 1 });
  });

  it('clamps right edge so visible rect stays inside bounds', () => {
    const v = { x: 9999, y: 100, scale: 1 };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 600, y: 100, scale: 1 });
  });

  it('clamps top edge to bounds.y', () => {
    const v = { x: 100, y: -50, scale: 1 };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 100, y: 0, scale: 1 });
  });

  it('clamps bottom edge', () => {
    const v = { x: 100, y: 9999, scale: 1 };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 100, y: 500, scale: 1 });
  });

  it('respects scale (visible rect = canvas/scale)', () => {
    // scale=2 → visible = 200×150. maxX = 1000 - 200 = 800.
    const v = { x: 9999, y: 100, scale: 2 };
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: 800, y: 100, scale: 2 });
  });

  it('centers axis when zoomed out past bounds extent', () => {
    // scale=0.25 → visible = 1600×1200. Wider than 1000 → centered.
    const v = { x: 9999, y: 9999, scale: 0.25 };
    // x: 0 + (1000 - 1600) / 2 = -300; y: 0 + (800 - 1200) / 2 = -200
    expect(clampView(v, BOUNDS, CANVAS)).toEqual({ x: -300, y: -200, scale: 0.25 });
  });

  it('honors non-zero bounds origin', () => {
    const bounds = { x: 100, y: 50, width: 1000, height: 800 };
    const v = { x: 0, y: 0, scale: 1 };
    expect(clampView(v, bounds, CANVAS)).toEqual({ x: 100, y: 50, scale: 1 });
  });
});
