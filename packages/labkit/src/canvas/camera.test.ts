import { describe, expect, it } from 'vitest';
import { centerOn, zoomAt } from './camera';
import { screenToWorld, worldToScreen } from './canvasCoords';
import { DEFAULT_FRAME, resolveFrame } from './worldSpec';

const view = { zoom: 2, pan: { x: 30, y: -10 } };

describe('zoomAt', () => {
  it('multiplies the zoom by the factor', () => {
    expect(zoomAt(view, 3, { x: 0, y: 0 }).zoom).toBe(6);
  });

  it('keeps the world point under the anchor fixed', () => {
    const at = { x: 120, y: 80 };
    const before = screenToWorld(at, view);
    const next = zoomAt(view, 3, at);
    expect(screenToWorld(at, next).x).toBeCloseTo(before.x, 10);
    expect(screenToWorld(at, next).y).toBeCloseTo(before.y, 10);
  });

  it('keeps it fixed on a frame whose origin is not the top-left', () => {
    const frame = resolveFrame(
      { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' },
      {
        width: 400,
        height: 300,
      },
    );
    const at = { x: 120, y: 80 };
    const before = screenToWorld(at, view, frame);
    const next = zoomAt(view, 3, at, { frame });
    expect(screenToWorld(at, next, frame).x).toBeCloseTo(before.x, 10);
    expect(screenToWorld(at, next, frame).y).toBeCloseTo(before.y, 10);
  });

  it('clamps to the bounds, and anchors on the zoom it actually reached', () => {
    const at = { x: 120, y: 80 };
    const next = zoomAt(view, 100, at, { max: 8 });
    expect(next.zoom).toBe(8);
    const before = screenToWorld(at, view);
    expect(screenToWorld(at, next).x).toBeCloseTo(before.x, 10);
  });

  it('treats a non-finite zoom as 1 rather than propagating NaN', () => {
    const next = zoomAt({ zoom: Number.NaN, pan: { x: 0, y: 0 } }, 2, { x: 10, y: 10 });
    expect(next.zoom).toBe(2);
    expect(Number.isFinite(next.pan.x)).toBe(true);
  });
});

describe('centerOn', () => {
  it('puts the world point at the middle of the viewport', () => {
    const world = { x: 12, y: -4 };
    const v = centerOn(world, 6, { width: 200, height: 120 });
    const p = worldToScreen(world, v);
    expect(p.x).toBeCloseTo(100, 10);
    expect(p.y).toBeCloseTo(60, 10);
  });

  it('respects the frame it is given', () => {
    const frame = resolveFrame(
      { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' },
      {
        width: 200,
        height: 120,
      },
    );
    const world = { x: 12, y: -4 };
    const v = centerOn(world, 6, { width: 200, height: 120 }, frame);
    const p = worldToScreen(world, v, frame);
    expect(p.x).toBeCloseTo(100, 10);
    expect(p.y).toBeCloseTo(60, 10);
  });

  it('carries the zoom it was given', () => {
    expect(centerOn({ x: 0, y: 0 }, 6, { width: 10, height: 10 }, DEFAULT_FRAME).zoom).toBe(6);
  });
});
