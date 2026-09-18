import { describe, it, expect } from 'vitest';
import {
  cornerWeights, evalPatch, isTensorPatch, isValidPatch, patchBounds, patchCorner,
  type MeshPatch, type MeshPoint,
} from './surface';

/** A unit square as a patch: straight edges, controls at the thirds. */
function squarePatch(): MeshPatch {
  const corners: MeshPoint[] = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ];
  const points: MeshPoint[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    points.push(
      a,
      { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
      { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 },
    );
  }
  return { points, colors: ['#f00', '#0f0', '#00f', '#ff0'] };
}

/** The same square as a tensor patch, its interior points where a flat
 *  bicubic puts them. */
function squareTensor(): MeshPatch {
  const coons = squarePatch();
  return {
    ...coons,
    points: [
      ...coons.points,
      { x: 1 / 3, y: 1 / 3 }, { x: 1 / 3, y: 2 / 3 },
      { x: 2 / 3, y: 2 / 3 }, { x: 2 / 3, y: 1 / 3 },
    ],
  };
}

describe('patch shape', () => {
  it('reads twelve points as Coons and sixteen as tensor', () => {
    expect(isTensorPatch(squarePatch())).toBe(false);
    expect(isTensorPatch(squareTensor())).toBe(true);
    expect(isValidPatch(squarePatch())).toBe(true);
    expect(isValidPatch(squareTensor())).toBe(true);
  });

  it('rejects a point count that is neither', () => {
    expect(isValidPatch({ points: [], colors: ['#000', '#000', '#000', '#000'] })).toBe(false);
    expect(isValidPatch({
      points: new Array(13).fill({ x: 0, y: 0 }),
      colors: ['#000', '#000', '#000', '#000'],
    })).toBe(false);
  });

  it('puts every third point at a corner', () => {
    const p = squarePatch();
    expect(patchCorner(p, 0)).toEqual({ x: 0, y: 0 });
    expect(patchCorner(p, 1)).toEqual({ x: 1, y: 0 });
    expect(patchCorner(p, 2)).toEqual({ x: 1, y: 1 });
    expect(patchCorner(p, 3)).toEqual({ x: 0, y: 1 });
  });
});

describe('evalPatch', () => {
  it('lands the four corners of the unit square at (u,v) 0 and 1', () => {
    const p = squarePatch();
    expect(evalPatch(p, 0, 0).x).toBeCloseTo(0, 10);
    expect(evalPatch(p, 0, 0).y).toBeCloseTo(0, 10);
    expect(evalPatch(p, 1, 0)).toMatchObject({ x: expect.closeTo(1, 10), y: expect.closeTo(0, 10) });
    expect(evalPatch(p, 1, 1)).toMatchObject({ x: expect.closeTo(1, 10), y: expect.closeTo(1, 10) });
    expect(evalPatch(p, 0, 1)).toMatchObject({ x: expect.closeTo(0, 10), y: expect.closeTo(1, 10) });
  });

  it('is the identity map on a square, so the interior is not warped', () => {
    const p = squarePatch();
    for (const [u, v] of [[0.5, 0.5], [0.25, 0.75], [0.1, 0.9]] as const) {
      const at = evalPatch(p, u, v);
      expect(at.x).toBeCloseTo(u, 6);
      expect(at.y).toBeCloseTo(v, 6);
    }
  });

  it('agrees with the tensor form when the interior points are where a flat patch puts them', () => {
    const coons = squarePatch();
    const tensor = squareTensor();
    for (const [u, v] of [[0.3, 0.2], [0.5, 0.5], [0.8, 0.9]] as const) {
      const a = evalPatch(coons, u, v);
      const b = evalPatch(tensor, u, v);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.y).toBeCloseTo(a.y, 6);
    }
  });

  it('follows a bowed edge into the interior', () => {
    const p = squarePatch();
    const bowed: MeshPatch = {
      ...p,
      // Pull the two controls of the first edge (corner 0 → 1) downward.
      points: p.points.map((pt, i) => (i === 1 || i === 2 ? { x: pt.x, y: -0.5 } : pt)),
    };
    // The edge itself bows away from the square…
    expect(evalPatch(bowed, 0.5, 0).y).toBeLessThan(-0.3);
    // …and the interior follows, weighted toward that edge.
    expect(evalPatch(bowed, 0.5, 0.25).y).toBeLessThan(evalPatch(p, 0.5, 0.25).y);
    // The opposite edge is untouched.
    expect(evalPatch(bowed, 0.5, 1).y).toBeCloseTo(1, 6);
  });

  it('moves a tensor patch interior without moving its boundary', () => {
    const flat = squareTensor();
    const pinched: MeshPatch = {
      ...flat,
      points: flat.points.map((pt, i) => (i === 14 ? { x: 0.9, y: 0.9 } : pt)),
    };
    for (const [u, v] of [[0, 0.5], [1, 0.5], [0.5, 0], [0.5, 1]] as const) {
      const a = evalPatch(flat, u, v);
      const b = evalPatch(pinched, u, v);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.y).toBeCloseTo(a.y, 6);
    }
    expect(evalPatch(pinched, 0.5, 0.5)).not.toEqual(evalPatch(flat, 0.5, 0.5));
  });
});

describe('cornerWeights', () => {
  it('gives a corner all the weight at its own (u,v)', () => {
    expect(cornerWeights(0, 0)).toEqual([1, 0, 0, 0]);
    expect(cornerWeights(1, 0)).toEqual([0, 1, 0, 0]);
    expect(cornerWeights(1, 1)).toEqual([0, 0, 1, 0]);
    expect(cornerWeights(0, 1)).toEqual([0, 0, 0, 1]);
  });

  it('sums to one everywhere, so a blend cannot gain or lose light', () => {
    for (const [u, v] of [[0.3, 0.7], [0.5, 0.5], [0.12, 0.34]] as const) {
      const sum = cornerWeights(u, v).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 12);
    }
  });
});

describe('patchBounds', () => {
  it('bounds the square tightly', () => {
    expect(patchBounds(squarePatch())).toMatchObject({
      x: expect.closeTo(0, 6), y: expect.closeTo(0, 6),
      width: expect.closeTo(1, 6), height: expect.closeTo(1, 6),
    });
  });

  it('follows the surface past a control point rather than out to it', () => {
    const p = squarePatch();
    const bowed: MeshPatch = {
      ...p,
      points: p.points.map((pt, i) => (i === 1 || i === 2 ? { x: pt.x, y: -1 } : pt)),
    };
    const box = patchBounds(bowed);
    // The control points sit at y = -1; the curve only reaches three quarters
    // of the way there, which is the whole reason this samples.
    expect(box.y).toBeGreaterThan(-1);
    expect(box.y).toBeLessThan(-0.6);
  });
});
