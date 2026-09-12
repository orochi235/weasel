import type { PoseDescriptor } from './poseDescriptor';

/** Test-only pose that is neither a rect nor a Path, so nothing built in can
 *  read it except through its descriptor. */
export interface CirclePose { cx: number; cy: number; r: number }

export const circle = (cx: number, cy: number, r: number): CirclePose => ({ cx, cy, r });

export const CIRCLE_POSE_DESCRIPTOR: PoseDescriptor<CirclePose> = {
  getBounds: (p) => ({ x: p.cx - p.r, y: p.cy - p.r, width: 2 * p.r, height: 2 * p.r }),
  remapBounds: (p, src, dst) => {
    const sx = src.width === 0 ? 1 : dst.width / src.width;
    const sy = src.height === 0 ? 1 : dst.height / src.height;
    return {
      cx: dst.x + (p.cx - src.x) * sx,
      cy: dst.y + (p.cy - src.y) * sy,
      r: p.r * Math.min(Math.abs(sx), Math.abs(sy)),
    };
  },
  translate: (p, dx, dy) => ({ cx: p.cx + dx, cy: p.cy + dy, r: p.r }),
  fromBounds: (b) => ({
    cx: b.x + b.width / 2,
    cy: b.y + b.height / 2,
    r: Math.min(b.width, b.height) / 2,
  }),
  supportsRotation: () => false,
};
