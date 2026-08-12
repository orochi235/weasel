import type { ResizePose, RotatedPose } from '../../gestures/types';

/**
 * Bridges arbitrary `TPose` shapes into the resize hook's bounds-driven math.
 * The hook reads bounds via `getBounds`, runs anchor-relative math on those
 * bounds, then asks `remapBounds` to project the result back into TPose.
 *
 * `remapBounds(pose, src, dst)` is a single operation that subsumes both
 * "set my own AABB to dst" (single-leaf resize) and "scale me as a leaf
 * inside parent's src→dst rect" (group resize) — they're the same affine
 * map. For rect-shaped poses the default geometry interprets the pose as
 * its own bounds; for Path or polygon poses the consumer supplies a
 * projection that knows how to read and rewrite the underlying geometry.
 */
export interface PoseProjection<TPose> {
  getBounds(pose: TPose): ResizePose;
  remapBounds(pose: TPose, src: ResizePose, dst: ResizePose): TPose;
  /** Translate the pose by (dx, dy). Optional — when omitted, callers fall
   *  back to a translation derived from `remapBounds` (origin shifted, no
   *  scale). Path-shaped poses should provide this for performance. */
  translate?(pose: TPose, dx: number, dy: number): TPose;
  /** True iff any portion of the pose's geometry intersects `rect`. Optional
   *  — when omitted, area-select and similar callers test against `getBounds`
   *  AABB (looser, but correct for axis-aligned rect poses). */
  intersectsRect?(pose: TPose, rect: ResizePose): boolean;
  /** Interpolate between two poses. Optional — animation helpers fall back to
   *  rect-shape lerp when omitted (which fails for non-rect poses). */
  lerp?(a: TPose, b: TPose, t: number): TPose;
  /** Read the pose's rotation in radians. Pivot is the AABB center
   *  (`getBounds(pose)` center). Default 0 when omitted — descriptor
   *  declares "this pose has no rotation." When supplied and non-zero,
   *  `useResize` projects the drag delta into the leaf's local frame,
   *  runs anchor math there, and translates the resulting pose so the
   *  diagonally opposite world-space corner is pinned. */
  getRotation?(pose: TPose): number;
  /** True iff this pose shape can carry a rotation. Consulted by the
   *  rotation affordance to decide whether to render the rotate cursor /
   *  drag-band over a selection. When omitted, the kit assumes `true` for
   *  back-compat — descriptors whose poses lack `x/y/width/height/rotation`
   *  fields (e.g. polygon Paths) should return `false` so the affordance
   *  hides instead of exposing a non-functional rotate cursor. */
  supportsRotation?(pose: TPose): boolean;
}

/** AABB-vs-AABB overlap. Exported for callers building a default
 *  `intersectsRect` from `getBounds`. */
export function aabbIntersectsRect(b: ResizePose, r: ResizePose): boolean {
  return b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y;
}

/** Identity geometry for `TPose extends ResizePose`. Treats the pose as its
 *  own bounds and remaps via affine scale against `src`/`dst`. */
export const RECT_POSE_DESCRIPTOR: PoseProjection<ResizePose> = {
  getBounds: (p) => p,
  remapBounds: (p, src, dst) => {
    const sx = src.width === 0 ? 1 : dst.width / src.width;
    const sy = src.height === 0 ? 1 : dst.height / src.height;
    return {
      ...p,
      x: dst.x + (p.x - src.x) * sx,
      y: dst.y + (p.y - src.y) * sy,
      width: p.width * sx,
      height: p.height * sy,
    };
  },
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  intersectsRect: (p, r) => aabbIntersectsRect(p, r),
  lerp: (a, b, t) => ({
    ...a,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  }),
};

/** Identity geometry for `RotatedPose`. Inherits rect-shape projection
 *  from `RECT_POSE_DESCRIPTOR` (the `RotatedPose extends ResizePose`
 *  subtype lets the rect descriptor's methods apply directly; `remapBounds`
 *  preserves the `rotation` field via `...p` spread). Adds `getRotation` so
 *  `useResize` knows to take the rotation-aware math path. */
export const ROTATED_POSE_DESCRIPTOR: PoseProjection<RotatedPose> = {
  getBounds: RECT_POSE_DESCRIPTOR.getBounds as PoseProjection<RotatedPose>['getBounds'],
  remapBounds: RECT_POSE_DESCRIPTOR.remapBounds as PoseProjection<RotatedPose>['remapBounds'],
  translate: RECT_POSE_DESCRIPTOR.translate as PoseProjection<RotatedPose>['translate'],
  intersectsRect: RECT_POSE_DESCRIPTOR.intersectsRect as PoseProjection<RotatedPose>['intersectsRect'],
  lerp: RECT_POSE_DESCRIPTOR.lerp as PoseProjection<RotatedPose>['lerp'],
  getRotation: (p) => p.rotation,
};

/**
 * Remap a **rotated** leaf inside a group resize.
 *
 * The naive `remapBounds` scales a leaf's axis-aligned `width`/`height` by the
 * group's per-axis factors and carries `rotation` through untouched. That is
 * right when `src`/`dst` are already expressed in the leaf's own frame — the
 * single-leaf resize path, where the drag delta was projected into that frame
 * before the anchor math ran. In a group resize they are world-frame, so the
 * leaf's local axes do not line up with the axes being scaled: at 90° a
 * horizontal stretch should grow the leaf's `height`, and the naive map grows
 * its `width`.
 *
 * What this computes is the group affine applied to the leaf's local frame,
 * with the shear dropped — the pose model is `{x, y, width, height, rotation}`
 * and cannot represent the parallelogram a non-uniform scale of a rotated box
 * actually produces. The centre moves exactly; each local axis takes the
 * length of its own image; the rotation follows the image of the local x-axis.
 *
 * Degenerates to the naive map at `rotation === 0`, and to a plain uniform
 * scale when `sx === sy`, both exactly.
 */
export function remapRotatedLeaf<TPose extends RotatedPose>(
  pose: TPose,
  src: ResizePose,
  dst: ResizePose,
): TPose {
  const sx = src.width === 0 ? 1 : dst.width / src.width;
  const sy = src.height === 0 ? 1 : dst.height / src.height;
  const theta = pose.rotation ?? 0;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // Images of the leaf's local unit axes under the group's diagonal scale.
  const ux = sx * cos, uy = sy * sin;
  const vx = -sx * sin, vy = sy * cos;

  const width = pose.width * Math.hypot(ux, uy);
  const height = pose.height * Math.hypot(vx, vy);
  const rotation = Math.atan2(uy, ux);

  // The centre is a point, so it takes the group affine directly.
  const cxNew = dst.x + (pose.x + pose.width / 2 - src.x) * sx;
  const cyNew = dst.y + (pose.y + pose.height / 2 - src.y) * sy;

  return {
    ...pose,
    x: cxNew - width / 2,
    y: cyNew - height / 2,
    width,
    height,
    rotation,
  };
}
