import { describe, expect, it } from 'vitest';
import { sampleByInterpolation, type InterpolationMode } from './interpolation';
import type { Point } from './catmullRom';

const TWO: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
const FOUR: Point[] = [
  { x: 0, y: 0 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 },
];

const MODES: InterpolationMode[] = [
  'linear',
  'catmull-rom',
  'catmull-rom-uniform',
  'catmull-rom-chordal',
  'monotone',
];

describe('sampleByInterpolation', () => {
  for (const mode of MODES) {
    it(`${mode}: returns empty for fewer than 2 anchors`, () => {
      expect(sampleByInterpolation([], 8, mode)).toEqual([]);
      expect(sampleByInterpolation([{ x: 0, y: 0 }], 8, mode)).toEqual([]);
    });

    it(`${mode}: returns (n-1)*samplesPerSegment + 1 points for n anchors`, () => {
      expect(sampleByInterpolation(FOUR, 8, mode).length).toBe(3 * 8 + 1);
    });

    it(`${mode}: passes through every anchor`, () => {
      const samples = sampleByInterpolation(FOUR, 8, mode);
      for (const a of FOUR) {
        const hit = samples.find(
          (s) => Math.abs(s.x - a.x) < 1e-6 && Math.abs(s.y - a.y) < 1e-6,
        );
        expect(hit).toBeDefined();
      }
    });

    it(`${mode}: two-anchor case is a straight line`, () => {
      const samples = sampleByInterpolation(TWO, 4, mode);
      expect(samples.length).toBe(5);
      for (const s of samples) {
        expect(s.y).toBeCloseTo(s.x, 6);
      }
    });
  }

  it('linear mode emits straight segments (interior samples lie on chord)', () => {
    const samples = sampleByInterpolation(FOUR, 4, 'linear');
    // First segment: (0,0) → (0.3, 0.1). Midpoint sample should be on
    // that chord at t=0.5 → (0.15, 0.05).
    const seg0Mid = samples[2];
    expect(seg0Mid.x).toBeCloseTo(0.15, 5);
    expect(seg0Mid.y).toBeCloseTo(0.05, 5);
  });
});
