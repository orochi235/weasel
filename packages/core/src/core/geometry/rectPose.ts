import type { PoseLinear } from '@weasel-js/geom';

/**
 * Axis-aligned rectangle pose with optional rotation. Rotation is in
 * radians, pivoted on the unrotated AABB center; absent === 0.
 */
export interface RectPose {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in radians around the unrotated AABB center. Absent === 0. */
  rotation?: number;
  /** A skew or per-axis scale the box and rotation cannot hold; see
   *  {@link PoseLinear}. Absent is the identity. */
  transform?: PoseLinear;
}
