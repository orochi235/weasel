import type { View } from 'core/viewport/view';
import type { ModifierState } from 'interactions/gestures/types';
import type { Guide } from '../types';

/** Axis-aligned bounding box. Alignment matches AABBs throughout; a rotated
 *  pose enters as the AABB of its ink (see `AlignBoundsProjection.boundsOf`). */
export interface AlignBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

/** Bounds analog of the gesture `OriginProjection`: reads an AABB from a pose
 *  and translates a pose. The rect default handles `{x,y,width,height}` poses;
 *  non-rect poses (Path, polygon) supply their own. */
export interface AlignBoundsProjection<TPose> {
  /** The pose's *visual* AABB — a rotated pose reports the extent of its ink,
   *  not the box it was posed in. Guides and matching both read this, so an
   *  implementation that returns the stored box makes a rotated shape snap to
   *  lines nothing is drawn at. */
  boundsOf(pose: TPose): AlignBounds;
  /** Move the pose, preserving every other field it carries — nothing
   *  downstream re-derives rotation or style from anywhere else. */
  translate(pose: TPose, dx: number, dy: number): TPose;
}

/** Which candidate lines to derive from a set of poses — edges, centers, or
 *  both, and whether the page box contributes its own. */
export interface DeriveAlignmentGuidesOptions<TPose = AlignBounds> {
  /** Include the document/page box's edges + center as candidates. */
  page?: AlignBounds;
  /** Emit left/right (x) and top/bottom (y) edge guides. Default true. */
  edges?: boolean;
  /** Emit centerX (x) and centerY (y) guides. Default true. */
  centers?: boolean;
  /** Reads each target's AABB. Defaults to `RECT_ALIGN_PROJECTION`. Pass the
   *  same projection `alignMoveBehavior` gets, or the two sides disagree. */
  projection?: AlignBoundsProjection<TPose>;
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
