import type { Bounds, PlaneMap, PoseDescriptor } from '@weasel-js/core';
import type { SpacingGap } from '../types';

/** Which edges of a box move on one axis during a spacing match: `'both'`
 *  for a translate, `'min'`/`'max'` for a resize dragging that edge. */
export type SpacingEdge = 'both' | 'min' | 'max';

/** The correction an equal-spacing match asks for, and the gaps to draw. */
export interface SpacingMatchResult {
  dx: number;
  dy: number;
  /** Every x gap equal to the one snapped to, the box's own included. */
  gapsX: SpacingGap[];
  gapsY: SpacingGap[];
}

/** Which candidate lines to derive from a set of poses — edges, centers, or
 *  both, and whether the page box contributes its own. */
export interface DeriveAlignmentGuidesOptions<TPose = Bounds> {
  /** Include the document/page box's edges + center as candidates. It is in
   *  the camera's world, as every line derived is. */
  page?: Bounds;
  /** The parallax plane a target's pose is stored in, for a sibling on a
   *  `parallax` layer (`view.planeOf(layer)`). Its box is carried out to the
   *  camera's world, which is the world alignment candidates are in. Omit it,
   *  or answer null, for a target already there. */
  planeOf?: (target: TPose, index: number) => PlaneMap | null | undefined;
  /** Emit left/right (x) and top/bottom (y) edge guides. Default true. */
  edges?: boolean;
  /** Emit centerX (x) and centerY (y) guides. Default true. */
  centers?: boolean;
  /** How to read each target. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
}
