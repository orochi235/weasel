import type { ResizePose } from '../types';

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
export interface PoseDescriptor<TPose> {
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
}

/** AABB-vs-AABB overlap. Exported for callers building a default
 *  `intersectsRect` from `getBounds`. */
export function aabbIntersectsRect(b: ResizePose, r: ResizePose): boolean {
  return b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y;
}

/** Identity geometry for `TPose extends ResizePose`. Treats the pose as its
 *  own bounds and remaps via affine scale against `src`/`dst`. */
export const RECT_POSE_DESCRIPTOR: PoseDescriptor<ResizePose> = {
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
