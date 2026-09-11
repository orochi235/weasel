import type { View } from 'core/viewport/view';
import type { ModifierState } from 'interactions/gestures/types';
import type { Guide } from '../types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';

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
  /** Tolerance (screen px when `getView` set, world units otherwise). */
  tolerance?: number;
  /** Read the active view; required for screen-pixel tolerance. */
  getView?: () => View;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: keyof ModifierState;
}
