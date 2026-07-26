/**
 * Rotation-convention parity guardrail.
 *
 * The kit applies "rotate about the pose's unrotated AABB center by
 * pose.rotation" in several places: the render-tree wrap, the world coordinate
 * bake (`pathInWorld`), the hit-test inverse (`poseContainsRotated`), and the
 * selection chrome (`rotatedRectCorners`). They all now derive from the single
 * `poseRotationOf` convention — this test asserts they map a reference point
 * identically, so any future consumer that re-derives the math and drifts
 * fails here.
 */
import { describe, it, expect } from 'vitest';
import { rotateAroundAABBCenter } from './poseRotation';
import { pathInWorld } from 'features/paths/pathInWorld';
import { poseRotationOf } from 'features/paths/poseRotation';
import { poseContainsRotated } from './SceneCanvas/poseGeometry';
import { rotatedRectCorners, rotatePoint } from 'interactions/actions/rotate/geometry';
import type { PolygonPath } from 'features/paths/types';

const pose = { x: 10, y: 20, width: 40, height: 20, rotation: Math.PI / 6 };
const cx = pose.x + pose.width / 2; // 30
const cy = pose.y + pose.height / 2; // 30

/** The canonical world position of the pose's top-left corner. */
const tl = rotatePoint(pose.x, pose.y, cx, cy, pose.rotation);

/** Apply a column-major [a,b,0,c,d,0,tx,ty,1] affine to a point. */
function applyMat(m: Float32Array, px: number, py: number): { x: number; y: number } {
  return { x: m[0] * px + m[3] * py + m[6], y: m[1] * px + m[4] * py + m[7] };
}

describe('rotation convention parity', () => {
  it('poseRotationOf yields the AABB-center pivot + angle', () => {
    expect(poseRotationOf(pose)).toEqual({ cx, cy, rotation: pose.rotation });
  });

  it('render-tree wrap maps the TL corner to the canonical world point', () => {
    const m = rotateAroundAABBCenter(pose.x, pose.y, pose.width, pose.height, pose.rotation);
    const w = applyMat(m, pose.x, pose.y);
    expect(w.x).toBeCloseTo(tl.x);
    expect(w.y).toBeCloseTo(tl.y);
  });

  it('world bake (pathInWorld) maps the TL corner to the canonical world point', () => {
    const rect = { kind: 'rect' as const, x: pose.x, y: pose.y, width: pose.width, height: pose.height };
    const baked = pathInWorld(rect, pose) as PolygonPath;
    // rect promotes to an M,L,L,L polygon starting at the TL corner.
    expect(baked.coords[0]).toBeCloseTo(tl.x);
    expect(baked.coords[1]).toBeCloseTo(tl.y);
  });

  it('selection chrome maps the TL corner to the canonical world point', () => {
    const corners = rotatedRectCorners(pose);
    expect(corners[0].x).toBeCloseTo(tl.x);
    expect(corners[0].y).toBeCloseTo(tl.y);
  });

  it('hit-test inverse agrees with the same convention', () => {
    // A world point one unit inside the TL corner along both rotated edges is
    // contained; its inverse maps just inside the local AABB.
    const inwardLocal = { x: pose.x + 1, y: pose.y + 1 };
    const inwardWorld = rotatePoint(inwardLocal.x, inwardLocal.y, cx, cy, pose.rotation);
    expect(poseContainsRotated(pose, inwardWorld.x, inwardWorld.y)).toBe(true);

    // A point just outside the TL corner (in the local frame) maps outside.
    const outwardLocal = { x: pose.x - 1, y: pose.y - 1 };
    const outwardWorld = rotatePoint(outwardLocal.x, outwardLocal.y, cx, cy, pose.rotation);
    expect(poseContainsRotated(pose, outwardWorld.x, outwardWorld.y)).toBe(false);
  });
});
