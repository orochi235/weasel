/** The `snap` dep: what a drawn or dragged point locks to. */

import type { Path } from '@weasel-js/geom';
import type { ResizeAnchor } from '@weasel-js/routing';
import type { PlaneMap } from 'core/viewport/parallax';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { SnapGesture, SnapMark } from 'features/snap/types';

type Point = { x: number; y: number };

/** Geometry a gesture brings to snap to that is in no scene node: what stays
 *  put of a path whose anchors it is dragging. World coords. */
export interface SnapGeometry {
  paths?: readonly Path[];
  /** Points to snap to as anchors. */
  anchors?: readonly Point[];
}

/** What a snap request knows about the gesture asking. Every field is
 *  optional, and a snapper that reads none of them answers the same. */
export interface SnapQuery {
  /** Where the geometry being drawn starts: a line's first end, the pen's
   *  last anchor, a move's base point. Tangent and perpendicular targets are
   *  measured from it. */
  origin?: Point;
  /** Nodes whose geometry offers no targets — what the gesture is moving. */
  exclude?: readonly string[];
  /** Only these nodes' geometry offers targets. */
  include?: readonly string[];
  /** Geometry to snap to besides the scene's, whatever `include` says. A
   *  snapper may index it once per object, so pass the same one each move. */
  also?: SnapGeometry;
}

/** What builds a gesture's input subspace while `snap.constrain` is held:
 *  an angle step in radians about `origin` (a rotate's every multiple of
 *  it, required), an axis or 45° lock about the press, or a resize's
 *  aspect. */
export type SnapConstrain = { step: number } | 'aspect' | 'axis';

/** The box a resize drags, as drawn, in its own frame. */
export interface SnapResizeBox {
  bounds: Bounds;
  /** Its frame into ctx coordinates, an affine map. Default: the identity. */
  toWorld?: (p: Point) => Point;
}

/** What a gesture tells the snap dep when it starts. Points are ctx
 *  coordinates: world in 2D. */
export interface SnapBegin {
  gesture: SnapGesture;
  press: Point;
  /** The subject, whose geometry offers no targets. */
  ids?: readonly string[];
  /** Resize: the sides the drag pins. An axis left `free` is an edge handle. */
  handle?: ResizeAnchor;
  /** Resize: the box `handle` belongs to. Default: the subject's drawn box,
   *  axis-aligned. */
  box?: SnapResizeBox;
  /** Rotate, handle: the point the angle turns about. Default `press`. */
  pivot?: Point;
  /** Rotate: the subject's angle at press, radians. Default 0. */
  theta0?: number;
  /** Angle gestures: the reach as an angle, radians, in place of screen px
   *  through the press radius; it overrides each source's `reachPx` and is
   *  not capped. */
  reachRad?: number;
  /** Point gestures: the previous anchor, a line's start. */
  origin?: Point;
  also?: SnapGeometry;
  constrain?: SnapConstrain;
  /** How the camera's world maps into the parallax plane the gesture's points
   *  are in, read each frame; absent or null in the camera's own world. */
  plane?: () => PlaneMap | null;
}

/** The snap roles held this frame. */
export interface SnapMods {
  /** No source answers; the input subspace still applies. */
  suspend: boolean;
  constrain: boolean;
}

export interface SnapOutcome {
  point: Point;
  /** Whether some target holds the point. */
  held: boolean;
  marks: readonly SnapMark[];
}

/** One gesture's snapping, from press to release. */
export interface SnapSession {
  /** Where `p` lands. */
  at(p: Point, mods: SnapMods): SnapOutcome;
  /** Where the angle `theta` (radians, about `pivot`) lands. */
  angle(theta: number, mods: SnapMods): { theta: number; marks: readonly SnapMark[] };
  /** Clears the gesture's marks. */
  end(): void;
}

/**
 * World-space point snapping — grid, guides, path geometry, or any consumer
 * rule. Actions apply it to the coords they ingest so the live preview and
 * the committed geometry agree.
 */
export interface SnapDep {
  /** Start a gesture's snap session. */
  begin?(req: SnapBegin): SnapSession;
  /** Snap a world-space point. Return `p` unchanged to opt out. */
  point(p: Point, at?: SnapQuery): Point;
  /** Snap `p` to a target alone — path geometry, or a point
   *  `toolOptions.snapTargets` offers — or null when none is in range. An
   *  anchor drag reads this, so a grid that the drawing tools follow
   *  does not start pulling dragged shapes too. */
  toTargets?(p: Point, at?: SnapQuery): Point | null;
  /** The gesture that asked is over: drop whatever marks its last snap. */
  release?(): void;
}
