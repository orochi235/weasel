/**
 * Hit-test a world-space point against a text node's pose rect. Uses the
 * pose's `width`/`height` directly — wrap-driven content overflow is not
 * considered. Suitable for click-to-edit where the pose rect is the
 * authoritative bounding box (selection outline, drag target).
 */

import type { TextPose } from './textLayer';

export interface PointInTextPoseOpts {
  /** Extra padding (world units) added to the rect on all sides. Default 0. */
  padding?: number;
}

export function pointInTextPose(
  x: number,
  y: number,
  pose: TextPose,
  opts: PointInTextPoseOpts = {},
): boolean {
  const p = opts.padding ?? 0;
  return (
    x >= pose.x - p &&
    x <= pose.x + pose.width + p &&
    y >= pose.y - p &&
    y <= pose.y + pose.height + p
  );
}
