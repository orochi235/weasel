import { describe, it, expect } from 'vitest';
import { remapRotatedLeaf, RECT_POSE_DESCRIPTOR } from './geometry';
import type { ResizePose } from '../../gestures/types';

const SRC: ResizePose = { x: 0, y: 0, width: 100, height: 100 };
const leaf = (over: Partial<ResizePose & { rotation: number }> = {}) => ({
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
    const dst: ResizePose = { x: 10, y: 20, width: 200, height: 50 };
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
    const dst: ResizePose = { x: 0, y: 0, width: 300, height: 300 };
    const p = leaf({ rotation: Math.PI / 7 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.width).toBeCloseTo(60);
    expect(out.height).toBeCloseTo(30);
    expect(out.rotation).toBeCloseTo(Math.PI / 7);
  });

  it('grows the height, not the width, when a 90° leaf is stretched sideways', () => {
    // This is the defect: at 90° the leaf's world-x extent is its `height`,
    // so doubling the group's width must double `height`.
    const dst: ResizePose = { x: 0, y: 0, width: 200, height: 100 };
    const p = leaf({ rotation: Math.PI / 2 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.height).toBeCloseTo(20);
    expect(out.width).toBeCloseTo(20);

    const naive = RECT_POSE_DESCRIPTOR.remapBounds(p, SRC, dst) as typeof p;
    expect(naive.width).toBeCloseTo(40);
    expect(naive.height).toBeCloseTo(10);
  });

  it('keeps the leaf footprint scaling with the group, axis by axis', () => {
    const dst: ResizePose = { x: 0, y: 0, width: 200, height: 100 };
    const p = leaf({ rotation: Math.PI / 2 });
    const before = footprint(p);
    const after = footprint(remapRotatedLeaf(p, SRC, dst));
    expect(after.x / before.x).toBeCloseTo(2);
    expect(after.y / before.y).toBeCloseTo(1);
  });

  it('moves the centre by the group affine exactly', () => {
    const dst: ResizePose = { x: 5, y: -10, width: 200, height: 50 };
    const p = leaf({ rotation: 0.7 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.x + out.width / 2).toBeCloseTo(5 + 50 * 2);
    expect(out.y + out.height / 2).toBeCloseTo(-10 + 45 * 0.5);
  });

  it('rotates the leaf toward the stretched axis', () => {
    // A 45° leaf in a group stretched 4:1 horizontally leans toward horizontal.
    const dst: ResizePose = { x: 0, y: 0, width: 400, height: 100 };
    const p = leaf({ rotation: Math.PI / 4 });
    const out = remapRotatedLeaf(p, SRC, dst);
    expect(out.rotation).toBeLessThan(Math.PI / 4);
    expect(out.rotation).toBeCloseTo(Math.atan2(1, 4));
  });

  it('preserves fields it does not own', () => {
    const dst: ResizePose = { x: 0, y: 0, width: 200, height: 100 };
    const p = { ...leaf({ rotation: 0.3 }), kind: 'rect' as const, id: 'leaf-1' };
    expect(remapRotatedLeaf(p, SRC, dst)).toMatchObject({ kind: 'rect', id: 'leaf-1' });
  });

  it('survives a degenerate source axis', () => {
    const flat: ResizePose = { x: 0, y: 0, width: 0, height: 100 };
    const out = remapRotatedLeaf(leaf({ rotation: 0.3 }), flat, { x: 0, y: 0, width: 50, height: 100 });
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.width)).toBe(true);
  });

  it('composes exactly except in the perpendicular extent', () => {
    // Dropping the shear loses information, but only in one quantity. The
    // rotation and the width both follow the image of the local x-axis, and
    // that image composes multiplicatively — so they are exact under any
    // number of steps. The height follows the perpendicular, and the
    // perpendicular of the mapped axis is not the image of the perpendicular:
    // that gap IS the shear. It is the only thing that drifts.
    const p = leaf({ rotation: 0.4 });
    const mid: ResizePose = { x: 0, y: 0, width: 150, height: 100 };
    const end: ResizePose = { x: 0, y: 0, width: 300, height: 100 };
    const once = remapRotatedLeaf(p, SRC, end);
    const twice = remapRotatedLeaf(remapRotatedLeaf(p, SRC, mid), mid, end);

    expect(twice.rotation).toBeCloseTo(once.rotation, 12);
    expect(twice.width).toBeCloseTo(once.width, 12);
    expect(twice.height).not.toBeCloseTo(once.height, 2);
  });

  it('does not drift across the frames of one drag', () => {
    // `resize.ts` remaps from the gesture's `startPoses` on every move, never
    // from the previous preview, so the one approximate quantity is computed
    // once from the origin however many times the pointer moves.
    const p = leaf({ rotation: 0.4 });
    const end: ResizePose = { x: 0, y: 0, width: 300, height: 100 };
    const frames = [150, 200, 260, 300].map(
      (width) => remapRotatedLeaf(p, SRC, { x: 0, y: 0, width, height: 100 }),
    );
    expect(frames[frames.length - 1].height).toBeCloseTo(remapRotatedLeaf(p, SRC, end).height, 12);
  });
});
