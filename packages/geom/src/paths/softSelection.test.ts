import { describe, expect, it } from 'vitest';
import type { AnchorSet } from './anchorEdits';
import { measureAnchorPath, softFalloff, softSelectionBand, softSelectionWeights } from './softSelection';

/** An open polyline along +X with anchors every 10 units. */
const line = (n: number): AnchorSet => ({
  anchors: [Array.from({ length: n }, (_, i) => ({ x: i * 10, y: 0 }))],
  closed: [false],
});

/** A closed square, 100 units a side, anchored at its corners. */
const square = (): AnchorSet => ({
  anchors: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]],
  closed: [true],
});

describe('softFalloff', () => {
  it('is 1 at the selection and 0 at the radius for every curve', () => {
    for (const f of ['smooth', 'linear', 'sharp'] as const) {
      expect(softFalloff(f, 0, 10)).toBe(1);
      expect(softFalloff(f, 10, 10)).toBe(0);
      expect(softFalloff(f, 12, 10)).toBe(0);
    }
  });

  it('orders the curves at the midpoint: smooth and linear meet, sharp falls below', () => {
    expect(softFalloff('linear', 5, 10)).toBeCloseTo(0.5);
    expect(softFalloff('smooth', 5, 10)).toBeCloseTo(0.5);
    expect(softFalloff('sharp', 5, 10)).toBeCloseTo(0.25);
    // Smooth holds near 1 close in, where linear has already fallen.
    expect(softFalloff('smooth', 1, 10)).toBeGreaterThan(softFalloff('linear', 1, 10));
  });

  it('gives nothing at a radius of zero', () => {
    expect(softFalloff('linear', 0, 0)).toBe(0);
  });
});

describe('softSelectionWeights', () => {
  it('weights neighbors by their distance along the path', () => {
    const w = softSelectionWeights(measureAnchorPath(line(6)), [0], 30, 'linear');
    expect(w.get(0)).toBe(1);
    expect(w.get(1)).toBeCloseTo(2 / 3);
    expect(w.get(2)).toBeCloseTo(1 / 3);
    expect(w.has(3)).toBe(false);
  });

  it('measures in screen pixels under a scale', () => {
    const w = softSelectionWeights(measureAnchorPath(line(4), { scale: { x: 2, y: 2 } }), [0], 30, 'linear');
    // Anchor 1 is 20px away at 2x, not 10.
    expect(w.get(1)).toBeCloseTo(1 / 3);
    expect(w.has(2)).toBe(false);
  });

  it('wraps round the seam of a closed subpath', () => {
    const w = softSelectionWeights(measureAnchorPath(square()), [0], 150, 'linear');
    // Anchors 1 and 3 are both one side away; anchor 2 is two sides away either way.
    expect(w.get(1)).toBeCloseTo(1 / 3);
    expect(w.get(3)).toBeCloseTo(1 / 3);
    expect(w.has(2)).toBe(false);
  });

  it('follows the curve, not the chord', () => {
    // A half-circle-ish arch: the chord from end to end is 100, the arc longer.
    const arch: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, outHandle: { x: 0, y: -66 } },
        { x: 100, y: 0, inHandle: { x: 100, y: -66 } },
      ]],
      closed: [false],
    };
    const w = softSelectionWeights(measureAnchorPath(arch), [0], 110, 'linear');
    expect(w.has(1)).toBe(false);
  });

  it('leaves a subpath with no selected anchor alone', () => {
    const two: AnchorSet = {
      anchors: [line(2).anchors[0]!, [{ x: 0, y: 5 }, { x: 10, y: 5 }]],
      closed: [false, false],
    };
    const w = softSelectionWeights(measureAnchorPath(two), [0], 100, 'linear');
    expect([...w.keys()].sort()).toEqual([0, 1]);
  });
});

describe('softSelectionBand', () => {
  it('covers the stretch within the radius, cut at the radius', () => {
    const set = line(6);
    const band = softSelectionBand(measureAnchorPath(set), set, [2], 15);
    expect(band).toHaveLength(1);
    const run = band[0]!;
    expect(run[0]!.x).toBeCloseTo(5);
    expect(run.at(-1)!.x).toBeCloseTo(35);
  });

  it('draws on the geometry it is given, measured on the original', () => {
    const origin = line(3);
    const moved: AnchorSet = { anchors: [origin.anchors[0]!.map((a) => ({ x: a.x, y: a.y + 50 }))], closed: [false] };
    const band = softSelectionBand(measureAnchorPath(origin), moved, [0], 100);
    expect(band[0]!.every((p) => p.y === 50)).toBe(true);
  });

  it('joins a stretch across the seam of a closed subpath into one run', () => {
    const set = square();
    const band = softSelectionBand(measureAnchorPath(set), set, [0], 50);
    expect(band).toHaveLength(1);
    const run = band[0]!;
    // From halfway up the left side, round the first corner, to halfway along the top.
    expect(run[0]!.x).toBe(0);
    expect(run[0]!.y).toBeCloseTo(50, 5);
    expect(run.at(-1)!.x).toBeCloseTo(50, 5);
    expect(run.some((p) => p.x === 0 && p.y === 0)).toBe(true);
  });

  it('gives a run per separated stretch', () => {
    const set = line(10);
    expect(softSelectionBand(measureAnchorPath(set), set, [1, 8], 5)).toHaveLength(2);
  });
});
