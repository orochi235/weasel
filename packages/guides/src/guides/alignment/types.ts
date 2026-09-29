import type { ModifierState, Bounds, PoseDescriptor } from '@weasel-js/core';
import type { Guide, SpacingGap } from '../types';

/** Which feature of a box to test against candidates, per axis.
 *  'min' = left/top edge, 'center' = centerline, 'max' = right/bottom edge. */
export type AlignAnchor = 'min' | 'center' | 'max';

/** The correction an alignment match asks for: the translation that lands the
 *  dragged bounds on the matched guides, and the guides themselves so they can
 *  be drawn. */
export interface AlignMatchResult {
  dx: number;
  dy: number;
  activeX: Guide | null;
  activeY: Guide | null;
}

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
  /** Include the document/page box's edges + center as candidates. */
  page?: Bounds;
  /** Emit left/right (x) and top/bottom (y) edge guides. Default true. */
  edges?: boolean;
  /** Emit centerX (x) and centerY (y) guides. Default true. */
  centers?: boolean;
  /** How to read each target. Pass the same descriptor `alignMoveBehavior`
   *  gets, or the two sides disagree. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
}

/** Common options shared by the three alignment behavior factories. */
export interface AlignmentBehaviorBase {
  /** Live candidate lines — consumer derives from current siblings + page. */
  getCandidates: () => readonly Guide[];
  /** Publish the currently-matched line(s). Called every onMove; cleared
   *  (`[]`) on a miss and on onEnd. */
  setActiveGuides: (guides: readonly Guide[]) => void;
  /** Tolerance in screen px, read through the gesture's view. Default 6. */
  tolerance?: number;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: keyof ModifierState;
  /** Boxes to measure gaps between for equal-spacing snaps (`matchSpacing`):
   *  the siblings' visual bounds, without the dragged ones. Omit to snap to
   *  alignment lines only. On each axis the nearer of the two snaps wins.
   *  Move and unrotated resize use it; insert does not. */
  getSpacingTargets?: () => readonly Bounds[];
  /** Publish the equal-gap markers. Called with the guides; cleared (`[]`) on
   *  a miss and on onEnd. */
  setActiveGaps?: (gaps: readonly SpacingGap[]) => void;
}
