import { describe, expect, it } from 'vitest';
import { cubicPointAt, splitCubicAtT, type Point } from './cubicMath';
import { fitCubicThroughDeletion } from './spanFit';
import type { PenAnchor } from './anchors';

/** Largest distance from `r` of any point on the cubic, from a circle at the origin. */
function worstRadialError(p0: Point, p1: Point, p2: Point, p3: Point, r: number): number {
  let worst = 0;
  for (let i = 0; i <= 64; i++) {
    const q = cubicPointAt(p0, p1, p2, p3, i / 64);
    worst = Math.max(worst, Math.abs(Math.hypot(q.x, q.y) - r));
  }
  return worst;
}

describe('fitCubicThroughDeletion', () => {
  it('gives back the original cubic when the anchor came from splitting it', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 10, y: 40 }, p2 = { x: 70, y: 50 }, p3 = { x: 100, y: 0 };
    const { left, right } = splitCubicAtT(p0, p1, p2, p3, 0.4);
    const { c1, c2 } = fitCubicThroughDeletion(
      { ...p0, outHandle: left[1] },
      { ...left[3], inHandle: left[2], outHandle: right[1] },
      { ...p3, inHandle: right[2] },
    );
    expect(c1.x).toBeCloseTo(p1.x, 1);
    expect(c1.y).toBeCloseTo(p1.y, 1);
    expect(c2.x).toBeCloseTo(p2.x, 1);
    expect(c2.y).toBeCloseTo(p2.y, 1);
  });

  it('keeps a half circle round when its middle anchor goes', () => {
    // Two quarter arcs of a radius-100 circle, from (100, 0) through (0, 100) to (-100, 0).
    const k = 100 * 0.5523;
    const prev: PenAnchor = { x: 100, y: 0, outHandle: { x: 100, y: k } };
    const removed: PenAnchor = { x: 0, y: 100, inHandle: { x: k, y: 100 }, outHandle: { x: -k, y: 100 } };
    const next: PenAnchor = { x: -100, y: 0, inHandle: { x: -100, y: k } };
    const { c1, c2 } = fitCubicThroughDeletion(prev, removed, next);
    expect(worstRadialError(prev, c1, c2, next, 100)).toBeLessThan(10);
  });

  it('keeps the directions the curve leaves and arrives with', () => {
    const { c1, c2 } = fitCubicThroughDeletion(
      { x: 0, y: 0, outHandle: { x: 0, y: 5 } },
      { x: 50, y: 30, inHandle: { x: 30, y: 30 }, outHandle: { x: 70, y: 30 } },
      { x: 100, y: 0, inHandle: { x: 100, y: 5 } },
    );
    expect(c1.x).toBeCloseTo(0, 6);
    expect(c1.y).toBeGreaterThan(5);
    expect(c2.x).toBeCloseTo(100, 6);
    expect(c2.y).toBeGreaterThan(5);
  });
});
