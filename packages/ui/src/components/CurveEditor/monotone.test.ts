import { describe, expect, it } from 'vitest';
import { sampleMonotone } from './monotone';
import type { Point } from './catmullRom';

describe('sampleMonotone', () => {
  it('returns empty for fewer than 2 anchors', () => {
    expect(sampleMonotone([], 8)).toEqual([]);
    expect(sampleMonotone([{ x: 0, y: 0 }], 8)).toEqual([]);
  });

  it('passes through every anchor', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0.5 }, { x: 3, y: 1 },
    ];
    const samples = sampleMonotone(anchors, 8);
    for (const a of anchors) {
      const hit = samples.find((s) => Math.abs(s.x - a.x) < 1e-6 && Math.abs(s.y - a.y) < 1e-6);
      expect(hit).toBeDefined();
    }
  });

  it('produces (n-1) * samplesPerSegment + 1 points', () => {
    const samples = sampleMonotone([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }], 8);
    expect(samples.length).toBe(2 * 8 + 1);
  });

  it('no overshoot: samples stay within [min(neighbor), max(neighbor)] per segment', () => {
    // Three points with a sharp spike in the middle. A non-monotone
    // algorithm (uniform Catmull-Rom etc.) would overshoot below y=0
    // entering the spike. Monotone must NOT.
    const anchors: Point[] = [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 },
    ];
    const samples = sampleMonotone(anchors, 16);
    for (const s of samples) {
      expect(s.y).toBeGreaterThanOrEqual(-1e-6);
      expect(s.y).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it('two-anchor case is a straight line', () => {
    const samples = sampleMonotone([{ x: 0, y: 0 }, { x: 1, y: 1 }], 4);
    expect(samples.length).toBe(5);
    for (const s of samples) {
      expect(s.y).toBeCloseTo(s.x, 6);
    }
  });
});
