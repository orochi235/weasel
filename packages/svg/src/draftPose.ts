import type { PoseLinear } from '@weasel-js/core';

/** Axis-aligned box, in the coordinate space of the SVG being unpacked. Used
 *  for the bounds a draft occupies before it becomes a scene node. */
export interface SvgDraftBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a draft node sits: its box, and the rotation or linear part its SVG transform left it with. */
export type SvgDraftPose = SvgDraftBounds & { rotation?: number; transform?: PoseLinear };
