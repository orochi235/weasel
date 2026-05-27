import { describe, expect, it } from 'vitest';
import {
  modelToPlot, plotToModel, hitTestAnchor, hitTestCurve,
  type ModelRange, type PlotSize, type Point,
} from './geometry';

const M: ModelRange = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
const P: PlotSize = { width: 200, height: 100 };

describe('modelToPlot / plotToModel', () => {
  it('maps (0,0) to bottom-left of plot', () => {
    const p = modelToPlot({ x: 0, y: 0 }, M, P);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(100, 6);
  });

  it('maps (1,1) to top-right of plot', () => {
    const p = modelToPlot({ x: 1, y: 1 }, M, P);
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('round-trips model → plot → model', () => {
    const m = { x: 0.37, y: 0.62 };
    const p = modelToPlot(m, M, P);
    const m2 = plotToModel(p, M, P);
    expect(m2.x).toBeCloseTo(m.x, 10);
    expect(m2.y).toBeCloseTo(m.y, 10);
  });

  it('handles non-unit ranges', () => {
    const M2: ModelRange = { xMin: -5, xMax: 5, yMin: 0, yMax: 100 };
    const p = modelToPlot({ x: 0, y: 50 }, M2, P);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(50, 6);
  });
});

describe('hitTestAnchor', () => {
  const anchors: Point[] = [
    { x: 10, y: 10 }, { x: 50, y: 20 }, { x: 100, y: 50 },
  ];

  it('returns index when pointer is within radius', () => {
    const hit = hitTestAnchor(anchors, { x: 12, y: 12 }, 5);
    expect(hit).toEqual({ index: 0 });
  });

  it('returns null when pointer is outside radius', () => {
    expect(hitTestAnchor(anchors, { x: 200, y: 200 }, 5)).toBeNull();
  });

  it('returns nearest anchor when multiple are within radius', () => {
    const hit = hitTestAnchor(anchors, { x: 51, y: 21 }, 10);
    expect(hit).toEqual({ index: 1 });
  });
});

describe('hitTestCurve', () => {
  const segments: Point[][] = [
    [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
    [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 100 }],
  ];

  it('returns segIdx+t for a point on the first segment', () => {
    const hit = hitTestCurve(segments, { x: 25, y: 0 }, 3);
    expect(hit).not.toBeNull();
    expect(hit!.segIdx).toBe(0);
    expect(hit!.t).toBeCloseTo(0.25, 1);
  });

  it('returns segIdx+t for a point on the second segment', () => {
    const hit = hitTestCurve(segments, { x: 100, y: 25 }, 3);
    expect(hit).not.toBeNull();
    expect(hit!.segIdx).toBe(1);
    expect(hit!.t).toBeCloseTo(0.25, 1);
  });

  it('returns null when pointer is far from the curve', () => {
    expect(hitTestCurve(segments, { x: 200, y: 200 }, 3)).toBeNull();
  });
});
