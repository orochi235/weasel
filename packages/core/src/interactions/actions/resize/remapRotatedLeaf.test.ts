import { describe, it, expect } from 'vitest';
import { remapRotatedLeaf, RECT_POSE_DESCRIPTOR } from './geometry';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { applyToPoint, poseFrameOf } from '@weasel-js/geom';

const SRC: Bounds = { x: 0, y: 0, width: 100, height: 100 };
const leaf = (over: Partial<Bounds & { rotation: number }> = {}) => ({
  x: 40, y: 40, width: 20, height: 10, rotation: 0, ...over,
});

/** World-space half-extents of a rotated box — what the leaf actually covers. */
function footprint(p: { width: number; height: number; rotation: number }) {
  const c = Math.abs(Math.cos(p.rotation));
  const s = Math.abs(Math.sin(p.rotation));
  return {
    x: (p.width * c + p.height * s) / 2,
    y: (p.width * s + p.height * c) / 2,
  };
}

describe('remapRotatedLeaf', () => {
  it('matches the naive remap when the leaf is unrotated', () => {
    const dst: Bounds = { x: 10, y: 20, width: 200, height: 50 };
    const p = leaf();
    const naive = RECT_POSE_DESCRIPTOR.remapBounds(p, SRC, dst) as typeof p;
    const rotated = remapRotatedLeaf(p, SRC, dst);
    expect(rotated.x).toBeCloseTo(naive.x);
    expect(rotated.y).toBeCloseTo(naive.y);
    expect(rotated.width).toBeCloseTo(naive.width);
    expect(rotated.height).toBeCloseTo(naive.height);
    expect(rotated.rotation).toBeCloseTo(0);
  });

  it('is a plain uniform scale when the group scales uniformly', () => {
    const dst: Bounds = { x: 0, y: 0, width: 300, height: 300 };
    const p = leaf({ rotation: Math.PI / 7 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.width).toBeCloseTo(60);
    expect(out.height).toBeCloseTo(30);
    expect(out.rotation).toBeCloseTo(Math.PI / 7);
  });

  it('grows the height, not the width, when a 90° leaf is stretched sideways', () => {
    // This is the defect: at 90° the leaf's world-x extent is its `height`,
    // so doubling the group's width must double `height`.
    const dst: Bounds = { x: 0, y: 0, width: 200, height: 100 };
    const p = leaf({ rotation: Math.PI / 2 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.height).toBeCloseTo(20);
    expect(out.width).toBeCloseTo(20);

    const naive = RECT_POSE_DESCRIPTOR.remapBounds(p, SRC, dst) as typeof p;
    expect(naive.width).toBeCloseTo(40);
    expect(naive.height).toBeCloseTo(10);
  });

  it('keeps the leaf footprint scaling with the group, axis by axis', () => {
    const dst: Bounds = { x: 0, y: 0, width: 200, height: 100 };
    const p = leaf({ rotation: Math.PI / 2 });
    const before = footprint(p);
    const after = footprint(remapRotatedLeaf(p, SRC, dst));
    expect(after.x / before.x).toBeCloseTo(2);
    expect(after.y / before.y).toBeCloseTo(1);
  });

  it('moves the centre by the group affine exactly', () => {
    const dst: Bounds = { x: 5, y: -10, width: 200, height: 50 };
    const p = leaf({ rotation: 0.7 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.x + out.width / 2).toBeCloseTo(5 + 50 * 2);
    expect(out.y + out.height / 2).toBeCloseTo(-10 + 45 * 0.5);
  });

  it('rotates the leaf toward the stretched axis', () => {
    // A 45° leaf in a group stretched 4:1 horizontally leans toward horizontal.
    const dst: Bounds = { x: 0, y: 0, width: 400, height: 100 };
    const p = leaf({ rotation: Math.PI / 4 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.rotation).toBeLessThan(Math.PI / 4);
    expect(out.rotation).toBeCloseTo(Math.atan2(1, 4));
  });

  it('preserves fields it does not own', () => {
    const dst: Bounds = { x: 0, y: 0, width: 200, height: 100 };
    const p = { ...leaf({ rotation: 0.3 }), kind: 'rect' as const, id: 'leaf-1' };
    expect(remapRotatedLeaf(p, SRC, dst)).toMatchObject({ kind: 'rect', id: 'leaf-1' });
  });

  it('survives a degenerate source axis', () => {
    const flat: Bounds = { x: 0, y: 0, width: 0, height: 100 };
    const out = remapRotatedLeaf(leaf({ rotation: 0.3 }), flat, { x: 0, y: 0, width: 50, height: 100 });
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.width)).toBe(true);
  });

  it('draws the same corners through two steps as through one', () => {
    const p = leaf({ rotation: 0.4 });
    const mid: Bounds = { x: 0, y: 0, width: 150, height: 100 };
    const end: Bounds = { x: 0, y: 0, width: 300, height: 100 };
    const once = remapRotatedLeaf(p, SRC, end);
    const twice = remapRotatedLeaf(remapRotatedLeaf(p, SRC, mid), mid, end);
    expect(maxError(corners(twice), corners(once))).toBeLessThan(1e-9);
  });
});

/** Where a pose draws its box corners. */
function corners(p: Bounds): [number, number][] {
  const m = poseFrameOf(p) ?? ([1, 0, 0, 1, 0, 0] as const);
  return ([[p.x, p.y], [p.x + p.width, p.y], [p.x + p.width, p.y + p.height], [p.x, p.y + p.height]] as const)
    .map(([x, y]) => applyToPoint(m, x, y));
}

/** `points` through the affine taking `src` onto `dst`. */
function through(points: [number, number][], src: Bounds, dst: Bounds): [number, number][] {
  return points.map(([x, y]) => [
    dst.x + ((x - src.x) * dst.width) / src.width,
    dst.y + ((y - src.y) * dst.height) / src.height,
  ]);
}

function maxError(a: [number, number][], b: [number, number][]): number {
  return Math.max(...a.map(([x, y], i) => Math.hypot(x - b[i][0], y - b[i][1])));
}

describe('remapRotatedLeaf writes the shear to the leaf transform', () => {
  const DST: Bounds = { x: 5, y: -10, width: 300, height: 60 };

  it('draws a turned leaf as the parallelogram a non-uniform resize makes of it', () => {
    const p = leaf({ rotation: 0.6 });
    const out = remapRotatedLeaf(p, SRC, DST);
    expect(out.transform).toBeDefined();
    expect(maxError(corners(out), through(corners(p), SRC, DST))).toBeLessThan(1e-9);
  });

  it('reads the skew a leaf already carries', () => {
    const upright = { ...leaf(), transform: [1, 0.2, -0.5, 1.2] as const };
    const turned = { ...upright, rotation: -0.9 };
    for (const p of [upright, turned]) {
      expect(maxError(corners(remapRotatedLeaf(p, SRC, DST)), through(corners(p), SRC, DST))).toBeLessThan(1e-9);
    }
  });

  it('writes no transform where the box and rotation hold the result', () => {
    const uniform: Bounds = { x: 0, y: 0, width: 300, height: 300 };
    expect('transform' in remapRotatedLeaf(leaf({ rotation: 0.6 }), SRC, uniform)).toBe(false);
    expect('transform' in remapRotatedLeaf(leaf(), SRC, DST)).toBe(false);
    expect('transform' in remapRotatedLeaf(leaf({ rotation: Math.PI / 2 }), SRC, DST)).toBe(false);
  });
});
