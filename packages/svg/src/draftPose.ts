import type { PoseLinear } from '@weasel-js/core';
import type { Rect } from '@weasel-js/geom';

/** Axis-aligned box, in the coordinate space of the SVG being unpacked. Used
 *  for the bounds a draft occupies before it becomes a scene node. */
export type SvgDraftBounds = Rect;

/** Where a draft node sits: its box, and the rotation or linear part its SVG transform left it with. */
export type SvgDraftPose = SvgDraftBounds & { rotation?: number; transform?: PoseLinear };
