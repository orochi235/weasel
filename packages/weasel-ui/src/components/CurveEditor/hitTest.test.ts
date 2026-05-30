import { describe, expect, it } from 'vitest';
import { hitTestAnchor, hitTestCurve } from './hitTest';
import type { Point } from '../Plot2D/geometry';

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
