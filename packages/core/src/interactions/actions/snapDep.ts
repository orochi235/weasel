/** The `snap` dep: what a drawn or dragged point locks to. */

import type { Path } from '@weasel-js/geom';
import type { ResizeAnchor } from '@weasel-js/routing';
import type { PlaneMap } from 'core/viewport/parallax';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { SnapGesture, SnapMark, SnapSource } from 'features/snap/types';

type Point = { x: number; y: number };

/** Geometry a gesture brings to snap to that is in no scene node: what stays
 *  put of a path whose anchors it is dragging. World coords. */
export interface SnapGeometry {
  paths?: readonly Path[];
  /** Points to snap to as anchors. */
  anchors?: readonly Point[];
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
  /** The container a subject not yet in the scene lands in: an insert's
   *  target. Absent for the top of the tree, or a gesture with `ids`. */
  parent?: string;
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
  /** Point gestures: the fixed end of what the gesture draws — a span's
   *  start, the previous anchor, the anchor a handle pulls from. Tangent and
   *  perpendicular targets are measured from it, a `constrain` step turns
   *  about it, and no point target on it is offered. */
  origin?: Point;
  also?: SnapGeometry;
  constrain?: SnapConstrain;
  /** How the camera's world maps into the parallax plane the gesture's points
   *  are in, read each frame; absent or null in the camera's own world. */
  plane?: () => PlaneMap | null;
  /** Sources asked for this gesture only, after the canvas's own, under the
   *  same ranking; one sharing an id with a source still asked throws. Their
   *  points are 2D world coordinates, so a 3D host does not take them. */
  sources?: readonly SnapSource[];
  /** Ids of sources this gesture does not ask: listed, registered or a
   *  canvas default. */
  omit?: readonly string[];
}

/** The snap roles held this frame. */
export interface SnapMods {
  /** No source answers; the input subspace still applies. */
  suspend: boolean;
  constrain: boolean;
  /** Angle gestures: the angle stays at `theta0`, which becomes a required
   *  target. */
  hold?: boolean;
}

/** Where a session put one frame's point, and the marks to draw for it. */
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
 * Snapping, for every gesture that snaps: each one begins a session at press
 * and asks it, frame by frame, where its point lands. Points are ctx
 * coordinates — world in 2D, screen in a 3D host.
 */
export interface SnapDep {
  /** Start a gesture's snap session. */
  begin(req: SnapBegin): SnapSession;
}
