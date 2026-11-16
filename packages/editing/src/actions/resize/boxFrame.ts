import type { PoseLinear } from '@weasel-js/geom';
import { targetTransformOf, type TargetTransform } from '@weasel-js/core/engine';
import type { Bounds } from '@weasel-js/core';

/** The frame `bounds` is drawn in while a box with this rotation and
 *  `transform` is resized: both about `bounds`' own center, which moves as
 *  the box does. */
export function boxFrame(
  box: { readonly rotation: number; readonly transform?: PoseLinear },
  bounds: Bounds,
): TargetTransform {
  return targetTransformOf({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    rotation: box.rotation, transform: box.transform,
  });
}
