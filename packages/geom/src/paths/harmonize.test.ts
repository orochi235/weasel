import { describe, expect, it } from 'vitest';
import { harmonizeAnchors } from './harmonize';
import { cubicCurvatureAt } from './curvature';
import { isAnchorSmooth } from './anchors';
import type { AnchorSet } from './anchorEdits';

/** An open S-free arch whose middle anchor is smooth but has a short in-handle
 *  and a long out-handle, so the bend jumps there. */
function lopsided(): AnchorSet {
  return {
    anchors: [[
      { x: 0, y: 100, outHandle: { x: 0, y: 40 } },
      { x: 100, y: 0, inHandle: { x: 80, y: 0 }, outHandle: { x: 180, y: 0 } },
      { x: 260, y: 100, inHandle: { x: 260, y: 30 } },
    ]],
    closed: [false],
  };
}

/** Curvature just before and just after anchor `idx` of subpath 0. */
function curvatureEitherSide(set: AnchorSet, idx: number): [number, number] {
  const sub = set.anchors[0];
  const n = sub.length;
  const prev = sub[(idx - 1 + n) % n];
  const a = sub[idx];
  const next = sub[(idx + 1) % n];
  return [
    cubicCurvatureAt(prev, prev.outHandle ?? prev, a.inHandle!, a, 1),
    cubicCurvatureAt(a, a.outHandle!, next.inHandle ?? next, next, 0),
  ];
}

describe('harmonizeAnchors', () => {
  it('matches the curvature either side of a smooth anchor', () => {
    const set = lopsided();
    const [before0, before1] = curvatureEitherSide(set, 1);
    expect(Math.abs(before0 - before1)).toBeGreaterThan(0.005);

    expect(harmonizeAnchors(set, [1])).toBe(true);
    const [k0, k1] = curvatureEitherSide(set, 1);
    expect(k0).toBeCloseTo(k1, 9);
  });

  it('keeps the handle directions and the product of their lengths', () => {
    const set = lopsided();
    const a = set.anchors[0][1];
    const product = (a.x - a.inHandle!.x) * (a.outHandle!.x - a.x);
    harmonizeAnchors(set, [1]);
    expect(a.inHandle!.y).toBeCloseTo(0, 12);
    expect(a.outHandle!.y).toBeCloseTo(0, 12);
    expect(isAnchorSmooth(a)).toBe(true);
    expect((a.x - a.inHandle!.x) * (a.outHandle!.x - a.x)).toBeCloseTo(product, 6);
  });

  it('settles every smooth anchor of a closed path together', () => {
    const set: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, inHandle: { x: -10, y: 60 }, outHandle: { x: 10, y: -60 } },
        { x: 100, y: -80, inHandle: { x: 40, y: -80 }, outHandle: { x: 120, y: -80 } },
        { x: 200, y: 0, inHandle: { x: 205, y: -30 }, outHandle: { x: 190, y: 60 } },
        { x: 100, y: 90, inHandle: { x: 170, y: 90 }, outHandle: { x: 60, y: 90 } },
      ]],
      closed: [true],
    };
    expect(harmonizeAnchors(set)).toBe(true);
    for (let i = 0; i < 4; i++) {
      const [k0, k1] = curvatureEitherSide(set, i);
      expect(k0).toBeCloseTo(k1, 6);
    }
    expect(harmonizeAnchors(set)).toBe(false);
  });

  it('finds nothing to do on a harmonized path stored in single precision', () => {
    const at = 1000;
    const set: AnchorSet = {
      anchors: [[
        { x: at, y: at, inHandle: { x: at - 10, y: at + 60 }, outHandle: { x: at + 10, y: at - 60 } },
        { x: at + 100, y: at - 80, inHandle: { x: at + 40, y: at - 80 }, outHandle: { x: at + 120, y: at - 80 } },
        { x: at + 200, y: at, inHandle: { x: at + 205, y: at - 30 }, outHandle: { x: at + 190, y: at + 60 } },
        { x: at + 100, y: at + 90, inHandle: { x: at + 170, y: at + 90 }, outHandle: { x: at + 60, y: at + 90 } },
      ]],
      closed: [true],
    };
    expect(harmonizeAnchors(set)).toBe(true);
    const f = (p: { x: number; y: number }) => ({ x: Math.fround(p.x), y: Math.fround(p.y) });
    const stored: AnchorSet = {
      anchors: set.anchors.map((sub) => sub.map((a) => ({
        ...f(a), ...(a.inHandle ? { inHandle: f(a.inHandle) } : {}), ...(a.outHandle ? { outHandle: f(a.outHandle) } : {}),
      }))),
      closed: set.closed,
    };
    expect(harmonizeAnchors(stored)).toBe(false);
  });

  it('leaves corners, open ends, and inflecting anchors alone', () => {
    const set: AnchorSet = {
      anchors: [[
        { x: 0, y: 0, outHandle: { x: 0, y: -40 } },
        // Smooth, but the curve bends up before it and down after it.
        { x: 100, y: 0, inHandle: { x: 70, y: 0 }, outHandle: { x: 160, y: 0 } },
        { x: 200, y: 0, inHandle: { x: 200, y: 40 }, outHandle: { x: 230, y: 30 } },
        { x: 300, y: 50, inHandle: { x: 280, y: 50 } },
      ]],
      closed: [false],
    };
    const before = JSON.stringify(set);
    expect(harmonizeAnchors(set)).toBe(false);
    expect(JSON.stringify(set)).toBe(before);
  });
});
