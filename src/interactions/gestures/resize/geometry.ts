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
export interface PoseGeometry<TPose> {
  getBounds(pose: TPose): ResizePose;
  remapBounds(pose: TPose, src: ResizePose, dst: ResizePose): TPose;
}

/** Identity geometry for `TPose extends ResizePose`. Treats the pose as its
 *  own bounds and remaps via affine scale against `src`/`dst`. */
export const RECT_POSE_GEOMETRY: PoseGeometry<ResizePose> = {
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
};
