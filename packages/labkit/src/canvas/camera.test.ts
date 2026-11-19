import { describe, expect, it } from 'vitest';
import { centerOn, labZoomAt } from './camera';
import { labScreenToWorld, labWorldToScreen } from './canvasCoords';
import { DEFAULT_FRAME, resolveFrame } from './worldSpec';

const view = { zoom: 2, pan: { x: 30, y: -10 } };

describe('labZoomAt', () => {
  it('multiplies the zoom by the factor', () => {
    expect(labZoomAt(view, 3, { x: 0, y: 0 }).zoom).toBe(6);
  });

  it('keeps the world point under the anchor fixed', () => {
    const at = { x: 120, y: 80 };
    const before = labScreenToWorld(at, view);
    const next = labZoomAt(view, 3, at);
    expect(labScreenToWorld(at, next).x).toBeCloseTo(before.x, 10);
    expect(labScreenToWorld(at, next).y).toBeCloseTo(before.y, 10);
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
    const before = labScreenToWorld(at, view, frame);
    const next = labZoomAt(view, 3, at, { frame });
    expect(labScreenToWorld(at, next, frame).x).toBeCloseTo(before.x, 10);
    expect(labScreenToWorld(at, next, frame).y).toBeCloseTo(before.y, 10);
  });

  it('clamps to the bounds, and anchors on the zoom it actually reached', () => {
    const at = { x: 120, y: 80 };
    const next = labZoomAt(view, 100, at, { max: 8 });
    expect(next.zoom).toBe(8);
    const before = labScreenToWorld(at, view);
    expect(labScreenToWorld(at, next).x).toBeCloseTo(before.x, 10);
  });

  it('keeps a view that arrived with a non-finite zoom finite', () => {
    const next = labZoomAt({ zoom: Number.NaN, pan: { x: 0, y: 0 } }, 2, { x: 10, y: 10 });
    expect(next.zoom > 0 && Number.isFinite(next.zoom)).toBe(true);
    expect(Number.isFinite(next.pan.x)).toBe(true);
  });

  it('keeps the zoom positive when a factor and bound would drive it to 0', () => {
    const at = { x: 10, y: 10 };
    const next = labZoomAt(view, 0, at, { min: 0 });
    expect(next.zoom > 0 && Number.isFinite(next.zoom)).toBe(true);
    expect(Number.isFinite(labScreenToWorld(at, next).x)).toBe(true);
  });
});

describe('centerOn', () => {
  it('puts the world point at the middle of the viewport', () => {
    const world = { x: 12, y: -4 };
    const v = centerOn(world, 6, { width: 200, height: 120 });
    const p = labWorldToScreen(world, v);
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
    const p = labWorldToScreen(world, v, frame);
    expect(p.x).toBeCloseTo(100, 10);
    expect(p.y).toBeCloseTo(60, 10);
  });

  it('carries the zoom it was given', () => {
    expect(centerOn({ x: 0, y: 0 }, 6, { width: 10, height: 10 }, DEFAULT_FRAME).zoom).toBe(6);
  });
});

describe('centerOn zoom invariant', () => {
  it('builds a camera with a positive zoom from a zoom of 0', () => {
    const v = centerOn({ x: 1, y: 1 }, 0, { width: 100, height: 100 });
    expect(v.zoom > 0 && Number.isFinite(v.zoom)).toBe(true);
    expect(Number.isFinite(labScreenToWorld({ x: 5, y: 5 }, v).x)).toBe(true);
  });
});
