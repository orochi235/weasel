import { describe, expect, it } from 'vitest';
import { sampleCurve, segmentSampleAt, type Point } from './catmullRom';

describe('segmentSampleAt', () => {
  it('returns p1 at t=0', () => {
    const p0: Point = { x: 0, y: 0 };
    const p1: Point = { x: 1, y: 1 };
    const p2: Point = { x: 2, y: 0 };
    const p3: Point = { x: 3, y: 1 };
    const r = segmentSampleAt(p0, p1, p2, p3, 0);
    expect(r.x).toBeCloseTo(1, 6);
    expect(r.y).toBeCloseTo(1, 6);
  });

  it('returns p2 at t=1', () => {
    const p0: Point = { x: 0, y: 0 };
    const p1: Point = { x: 1, y: 1 };
    const p2: Point = { x: 2, y: 0 };
    const p3: Point = { x: 3, y: 1 };
    const r = segmentSampleAt(p0, p1, p2, p3, 1);
    expect(r.x).toBeCloseTo(2, 6);
    expect(r.y).toBeCloseTo(0, 6);
  });

  it('interpolates monotonically between p1 and p2 for linear control points', () => {
    const p0: Point = { x: 0, y: 0 };
    const p1: Point = { x: 1, y: 1 };
    const p2: Point = { x: 2, y: 2 };
    const p3: Point = { x: 3, y: 3 };
    const r = segmentSampleAt(p0, p1, p2, p3, 0.5);
    expect(r.x).toBeCloseTo(1.5, 4);
    expect(r.y).toBeCloseTo(1.5, 4);
  });
});

describe('sampleCurve', () => {
  it('returns empty array for fewer than 2 anchors', () => {
    expect(sampleCurve([], 8)).toEqual([]);
    expect(sampleCurve([{ x: 0, y: 0 }], 8)).toEqual([]);
  });

  it('passes through every anchor', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
    ];
    const samples = sampleCurve(anchors, 8);
    expect(samples[0]).toEqual(anchors[0]);
    expect(samples[samples.length - 1]).toEqual(anchors[anchors.length - 1]);
    for (const a of anchors) {
      const hit = samples.find((s) => Math.abs(s.x - a.x) < 1e-6 && Math.abs(s.y - a.y) < 1e-6);
      expect(hit).toBeDefined();
    }
  });

  it('produces (n-1)*samplesPerSegment + 1 samples for n anchors', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 },
    ];
    const samples = sampleCurve(anchors, 8);
    expect(samples.length).toBe(2 * 8 + 1);
  });

  it('reflects phantom endpoints (curve stays on chord for colinear anchors)', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    ];
    const samples = sampleCurve(anchors, 4);
    for (const s of samples) {
      expect(s.y).toBeCloseTo(0, 6);
    }
  });

  it('produces a 2-anchor curve as a straight line', () => {
    const samples = sampleCurve([{ x: 0, y: 0 }, { x: 1, y: 1 }], 4);
    expect(samples.length).toBe(5);
    expect(samples[0]).toEqual({ x: 0, y: 0 });
    expect(samples[4]).toEqual({ x: 1, y: 1 });
    for (const s of samples) {
      expect(s.y).toBeCloseTo(s.x, 6);
    }
  });
});
