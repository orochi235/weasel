import type { View } from 'core/viewport/view';
import type { ModifierState } from 'interactions/gestures/types';
import type { Guide } from '../types';

/** Axis-aligned bounding box. Rotation is ignored in v1 (alignment uses AABBs). */
export interface AlignBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which feature of a box to test against candidates, per axis.
 *  'min' = left/top edge, 'center' = centerline, 'max' = right/bottom edge. */
export type AlignAnchor = 'min' | 'center' | 'max';

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
  boundsOf(pose: TPose): AlignBounds;
  translate(pose: TPose, dx: number, dy: number): TPose;
}

export interface DeriveAlignmentGuidesOptions {
  /** Include the document/page box's edges + center as candidates. */
  page?: AlignBounds;
  /** Emit left/right (x) and top/bottom (y) edge guides. Default true. */
  edges?: boolean;
  /** Emit centerX (x) and centerY (y) guides. Default true. */
  centers?: boolean;
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
