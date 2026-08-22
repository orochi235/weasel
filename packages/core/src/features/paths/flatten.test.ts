/**
 * Tests for the Bezier flattening kernels. Pure recursive subdividers; we
 * verify (1) emitted polyline endpoints, (2) tolerance behavior — tighter
 * tolerance produces more vertices, (3) degeneracies (collinear control
 * points exit at the base case in one shot), (4) the arc-length variants
 * accumulate cumulative distance correctly.
 */
import { describe, it, expect } from 'vitest';
import {
  flattenCubic,
  flattenQuadratic,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
  DEFAULT_FLATTEN_TOLERANCE,
} from './flatten';

const TIGHT = 0.01;
const LOOSE = 5.0;

describe('flattenCubic', () => {
  it('emits at least the endpoint at the end of the polyline', () => {
    const out: number[] = [];
    flattenCubic(0, 0, 1, 1, 2, 1, 3, 0, DEFAULT_FLATTEN_TOLERANCE, out);
    // Last emitted vertex must be the curve endpoint (3, 0).
    expect(out[out.length - 2]).toBe(3);
    expect(out[out.length - 1]).toBe(0);
  });

  it('does NOT emit the start point — caller already has it', () => {
    const out: number[] = [];
    flattenCubic(0, 0, 1, 1, 2, 1, 3, 0, DEFAULT_FLATTEN_TOLERANCE, out);
    // First emitted vertex must not be (0, 0).
    expect([out[0], out[1]]).not.toEqual([0, 0]);
  });

  it('collinear cubic exits at the base case (single segment)', () => {
    // P0..P3 all on the line y=0. Both control distances to chord = 0.
    const out: number[] = [];
    flattenCubic(0, 0, 1, 0, 2, 0, 3, 0, DEFAULT_FLATTEN_TOLERANCE, out);
    expect(out).toEqual([3, 0]);
  });

  it('tighter tolerance emits more vertices', () => {
    const tight: number[] = [];
    const loose: number[] = [];
    flattenCubic(0, 0, 0, 10, 10, 10, 10, 0, TIGHT, tight);
    flattenCubic(0, 0, 0, 10, 10, 10, 10, 0, LOOSE, loose);
    expect(tight.length).toBeGreaterThan(loose.length);
  });

  it('zero-length chord with off-line controls still flattens (no divide-by-zero)', () => {
    // P0 == P3, controls off the line. distPointToLine's len2==0 branch
    // returns the raw distance — recursion must still terminate.
    const out: number[] = [];
    flattenCubic(5, 5, 6, 6, 4, 4, 5, 5, DEFAULT_FLATTEN_TOLERANCE, out);
    expect(out.length).toBeGreaterThan(0);
    expect(out[out.length - 2]).toBe(5);
    expect(out[out.length - 1]).toBe(5);
  });
});

describe('flattenQuadratic', () => {
  it('emits the endpoint last and not the start', () => {
    const out: number[] = [];
    flattenQuadratic(0, 0, 5, 5, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out);
    expect(out[out.length - 2]).toBe(10);
    expect(out[out.length - 1]).toBe(0);
    expect([out[0], out[1]]).not.toEqual([0, 0]);
  });

  it('collinear quadratic = single segment', () => {
    const out: number[] = [];
    flattenQuadratic(0, 0, 5, 0, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out);
    expect(out).toEqual([10, 0]);
  });

  it('tighter tolerance subdivides more', () => {
    const tight: number[] = [];
    const loose: number[] = [];
    flattenQuadratic(0, 0, 5, 10, 10, 0, TIGHT, tight);
    flattenQuadratic(0, 0, 5, 10, 10, 0, LOOSE, loose);
    expect(tight.length).toBeGreaterThan(loose.length);
  });
});

describe('flattenCubicWithArcLen', () => {
  it('arcOut and out have the same number of vertices', () => {
    const out: number[] = [];
    const arc: number[] = [];
    flattenCubicWithArcLen(0, 0, 0, 10, 10, 10, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc);
    expect(arc.length).toBe(out.length / 2);
  });

  it('arc values are cumulative (monotonically non-decreasing)', () => {
    const out: number[] = [];
    const arc: number[] = [];
    flattenCubicWithArcLen(0, 0, 0, 10, 10, 10, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc);
    for (let i = 1; i < arc.length; i++) {
      expect(arc[i]).toBeGreaterThanOrEqual(arc[i - 1]);
    }
  });

  it('returns the final accumulated arc length, equal to the last arc entry', () => {
    const out: number[] = [];
    const arc: number[] = [];
    const total = flattenCubicWithArcLen(0, 0, 0, 10, 10, 10, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc);
    expect(total).toBe(arc[arc.length - 1]);
  });

  it('collinear cubic arc length matches chord length', () => {
    // 0..3 on y=0: arc = 3.
    const out: number[] = [];
    const arc: number[] = [];
    const total = flattenCubicWithArcLen(0, 0, 1, 0, 2, 0, 3, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc);
    expect(total).toBeCloseTo(3, 5);
  });
});

describe('flattenQuadraticWithArcLen', () => {
  it('arcOut and out have the same number of vertices', () => {
    const out: number[] = [];
    const arc: number[] = [];
    flattenQuadraticWithArcLen(0, 0, 5, 10, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc);
    expect(arc.length).toBe(out.length / 2);
  });

  it('returned total matches the last arc entry', () => {
    const out: number[] = [];
    const arc: number[] = [];
    const total = flattenQuadraticWithArcLen(0, 0, 5, 10, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc);
    expect(total).toBe(arc[arc.length - 1]);
  });

  it('arc values monotonically non-decreasing', () => {
    const out: number[] = [];
    const arc: number[] = [];
    flattenQuadraticWithArcLen(0, 0, 5, 10, 10, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc);
    for (let i = 1; i < arc.length; i++) {
      expect(arc[i]).toBeGreaterThanOrEqual(arc[i - 1]);
    }
  });
});

// --- degenerate inputs must terminate ---

describe('flatten guards', () => {
  const CTRL = [0, 0, 0, 100, 100, 100, 100, 0] as const;

  it('flattenCubic terminates on a non-finite control point', () => {
    const out: number[] = [];
    expect(() => flattenCubic(0, 0, NaN, 100, 100, 100, 100, 0, DEFAULT_FLATTEN_TOLERANCE, out)).not.toThrow();
    expect(out).toEqual([100, 0]);
  });

  it('flattenCubic terminates on an infinite control point', () => {
    const out: number[] = [];
    expect(() => flattenCubic(0, 0, Infinity, 100, 100, 100, 100, 0, DEFAULT_FLATTEN_TOLERANCE, out)).not.toThrow();
    expect(out).toEqual([100, 0]);
  });

  it('flattenQuadratic terminates on a non-finite control point', () => {
    const out: number[] = [];
    expect(() => flattenQuadratic(0, 0, NaN, 100, 100, 0, DEFAULT_FLATTEN_TOLERANCE, out)).not.toThrow();
    expect(out).toEqual([100, 0]);
  });

  it('flattenCubicWithArcLen terminates on a non-finite control point', () => {
    const out: number[] = [];
    const arc: number[] = [];
    expect(() => flattenCubicWithArcLen(0, 0, NaN, 100, 100, 100, 100, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc)).not.toThrow();
    expect(out).toEqual([100, 0]);
    expect(arc).toHaveLength(1);
  });

  it('flattenQuadraticWithArcLen terminates on a non-finite control point', () => {
    const out: number[] = [];
    const arc: number[] = [];
    expect(() => flattenQuadraticWithArcLen(0, 0, NaN, 100, 100, 0, DEFAULT_FLATTEN_TOLERANCE, out, arc)).not.toThrow();
    expect(out).toEqual([100, 0]);
    expect(arc).toHaveLength(1);
  });

  it('flattenCubic terminates on a negative tolerance without exploding', () => {
    const out: number[] = [];
    expect(() => flattenCubic(...CTRL, -1, out)).not.toThrow();
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(100000);
  });

  it('flattenCubic terminates on a zero tolerance without exploding', () => {
    const out: number[] = [];
    expect(() => flattenCubic(...CTRL, 0, out)).not.toThrow();
    expect(out.length).toBeLessThan(100000);
  });

  it('flattenCubic terminates on a NaN tolerance', () => {
    const out: number[] = [];
    expect(() => flattenCubic(...CTRL, NaN, out)).not.toThrow();
    expect(out.length).toBeLessThan(100000);
  });

  it('flattenQuadratic terminates on a negative tolerance without exploding', () => {
    const out: number[] = [];
    expect(() => flattenQuadratic(0, 0, 50, 100, 100, 0, -1, out)).not.toThrow();
    expect(out.length).toBeLessThan(100000);
  });
});
