/** The snap source contract: what a target set offers a snap session, and
 *  the marks a session draws for what it met. */

import type { ProbeRole, SnapTier } from '@weasel-js/geom/nd';
import type { WorldPoint } from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PlaneMap } from 'core/viewport/parallax';
import type { SnapGeometry, SnapMods } from 'interactions/actions/snapDep';
import type { OriginProjection } from 'interactions/gestures/shared/originProjection';
import type { Point } from '@weasel-js/geom';

/** The positions a target allows: `at` plus any combination of `dirs`. No
 *  dirs is a point, one a line, two a plane. */
export interface Locus<P = Point> {
  at: P;
  dirs: readonly P[];
  /** One interval per dir, in multiples of it: a segment or a bounded face. */
  span?: readonly (readonly [number, number])[];
}

/** An affine map between a frame and world, in a host's point type. */
export interface SnapFrame<P = Point> {
  /** A point given in the frame, in world. */
  toWorld(p: P): P;
  /** A world point in the frame; null where nothing maps back. */
  toLocal(p: P): P | null;
}

/** One locus a source offers one probe. */
export interface SourceCandidate<P = Point> {
  /** The id of a probe the source was offered. */
  probe: string;
  locus: Locus<P>;
  /** The result must meet one required candidate, whatever its reach. */
  required?: boolean;
  /** Drawn when the result meets this candidate. A function is handed the
   *  resolved move, so the marks can sit where the probe landed. */
  mark?: SnapMarks<P> | ((delta: P) => SnapMarks<P>);
}

/** `'handle'` is an angle about an anchor, as `'rotate'` is about a pivot,
 *  but asks only sources that name it. */
export type SnapGesture = 'point' | 'move' | 'resize' | 'rotate' | 'handle';

/** One side of the subject's box a resize moves: on `axis`, its `side` moves
 *  by `rate · (delta − delta0)`. A turned box's axis-aligned extent moves at
 *  a rate off its axis, and both its sides on one axis may move at once. */
export interface SnapSide<P = Point> {
  axis: 'x' | 'y';
  side: 'min' | 'max';
  rate: P;
}

/** A point on the subject that should land on a locus. */
export interface SnapProbeAt<P = Point> {
  id: string;
  at: P;
  role: ProbeRole;
}

/** What a session asks a source for, once per frame. */
export interface SnapCollect<P = Point> {
  gesture: SnapGesture;
  /** The probes this source matches, where the unsnapped gesture puts them. */
  probes: readonly SnapProbeAt<P>[];
  /** The unsnapped move from the press. A probe at `at` here lands at
   *  `at - delta0 + delta` for the resolved `delta` a function mark gets. */
  delta0: P;
  /** The subject's drawn box, stroke included, where the unsnapped gesture
   *  puts it: a move's union of boxes, or the box a resize drags. Absent for
   *  other gestures. */
  box?: Bounds;
  /** The sides of `box` a resize moves; a side not listed stands still.
   *  Absent for a move, which carries the whole box with it. */
  sides?: readonly SnapSide<P>[];
  /** The subject's drawn box where the resolved move `delta` (a function
   *  mark's argument) puts it. Absent where `box` is. */
  boxAt?(delta: P): Bounds;
  /** `id`'s drawn box, measured as `box` is. Absent in a host with no 2D
   *  scene. */
  drawnBox?(id: string): Bounds | undefined;
  /** The subject: the nodes the gesture moves or resizes. Absent for a
   *  gesture with none, such as drawing a new shape. */
  ids?: readonly string[];
  /** Where a gesture with no subject yet puts what it draws: the container a
   *  new node lands in. Absent for the top of the tree. */
  parent?: string;
  /** Nodes that offer no targets: what the gesture moves. */
  exclude: readonly string[];
  /** Only these nodes offer targets. */
  include?: readonly string[];
  /** Where the geometry being drawn starts; tangent and perpendicular targets
   *  are measured from it. */
  origin?: P;
  also?: SnapGeometry;
  /** `px` screen pixels as world units: a radius to cull targets by. */
  reachWorld(px: number): number;
  /** The reach, in screen px, the session applies to this source: its own
   *  `reachPx`, else the canvas's. Candidates past it are dropped anyway. */
  reachPx: number;
  /** Absent in a host with no 2D scene. */
  scene?: Scene<unknown, string, unknown>;
  /** `id`'s own frame: the coordinates its box is laid out in, from its
   *  corner along its own axes, turned and transformed as it is drawn. A
   *  container whose pose is a frame stores its children's poses in it.
   *  Undefined for a node with no box; absent in a host that has none. */
  frameOf?(id: string): SnapFrame<P> | undefined;
  /** How the camera's world maps into the parallax plane the probes are in.
   *  Absent in the camera's own world. A target the camera draws, a grid or
   *  a ruler guide, is carried through it. */
  plane?: PlaneMap | null;
}

/** What a rotate or handle drag asks a source for, once per frame. Angles
 *  are radians about `pivot`, in the frame `rotationOf` reads. */
export interface AngleCollect {
  pivot: WorldPoint;
  /** Where the gesture was pressed: its distance from `pivot` is the radius
   *  the default marks are drawn at. */
  press: WorldPoint;
  /** The angle at press. */
  theta0: number;
  /** The unsnapped angle now. */
  theta: number;
  /** The subject. */
  ids: readonly string[];
  /** Nodes that offer no targets: the subject and everything under it. */
  exclude: readonly string[];
  mods: SnapMods;
  also?: SnapGeometry;
  /** Absent in a host with no 2D scene. */
  scene?: Scene<unknown, string, unknown>;
  /** `id`'s world rotation, read as the subject's is; undefined for a node
   *  that cannot turn. */
  rotationOf?(id: string): number | undefined;
}

/** An angle a source offers. The session compares it round the circle, so
 *  any whole turn of it is the same target. */
export interface AngleCandidate {
  angle: number;
  /** The result must land on one required angle, whatever its reach. */
  required?: boolean;
  /** Drawn when the result lands on it. Default: a ray from the pivot along
   *  the snapped angle, labeled in degrees. */
  mark?: SnapMarks;
}

/** A set of snap targets. */
export interface SnapSource<P = Point> {
  id: string;
  /** Default `'target'`. A fallback never displaces a target in reach. */
  tier?: SnapTier;
  /** Overrides the canvas's reach for this source, in screen px. */
  reachPx?: number;
  /** The probe roles it matches; it is never offered a probe of another. */
  roles: readonly ProbeRole[];
  /** Default: every gesture but `'rotate'` and `'handle'`. */
  gestures?: readonly SnapGesture[];
  collect(q: SnapCollect<P>): Iterable<SourceCandidate<P>>;
  /** Angle targets, for a source whose `gestures` include `'rotate'` or `'handle'`. */
  angles?(q: AngleCollect): Iterable<AngleCandidate>;
}

/** One mark, or several, for one candidate. */
export type SnapMarks<P = Point> = SnapMark<P> | readonly SnapMark<P>[];

/** What a session draws for a candidate the result meets. World coords. */
export type SnapMark<P = Point> =
  | { kind: 'point'; at: P; glyph: string; label?: string; color?: string }
  | { kind: 'line'; from: P; to: P; color?: string }
  | { kind: 'gap'; from: P; to: P; value: number; color?: string }
  | { kind: 'distance'; from: P; to: P; value: number; color?: string };

/** `<SceneCanvas snap>`. */
export interface SceneCanvasSnap {
  /** Sources ahead of the presets' `snapSources` and any `useSnapSource`.
   *  One source per id is asked: the last listed, in the order prop,
   *  presets, `useSnapSource` in mount order. A canvas default (`'rotation'`,
   *  `'path-snap'`) loses to any of them. */
  sources?: readonly SnapSource[];
  /** Ids of canvas defaults to leave out: `'rotation'` stops a rotate
   *  snapping to quarter turns and other nodes' angles (Shift's step is the
   *  rotate's own and stays), and `'path-snap'` stops a point gesture (the
   *  pen, an anchor drag, a drawn line's ends, a measurement) snapping to
   *  other nodes' anchors. */
  omit?: readonly string[];
  /** The reach of a source that sets none, in screen px. Default: the kit
   *  setting `targets.snapPx`. */
  reachPx?: number;
  /** How a pose's origin is read, for the `origin` probe a grid snaps on a
   *  turned container's lattice: a pose neither a rect nor a `Path` needs
   *  its own. Default `AUTO_ORIGIN_PROJECTION`. */
  originProjection?: OriginProjection<unknown>;
  /** Whether the canvas draws the snap marks. Default `true`. With `false`
   *  the marks are still written to the `snapReadout` dep's store, for a
   *  layer of the consumer's own. */
  readout?: boolean;
  /** The readout's default colors and line width, for a mark that sets no `color`. */
  readoutStyle?: SnapReadoutStyle;
}

/** The snap readout's colors and line width, for a mark that sets no `color`. */
export interface SnapReadoutStyle {
  /** Points, lines and their labels. Default orange, as the path marker. */
  color?: string;
  /** Gap and distance marks. Default blue, as the guides. */
  gapColor?: string;
  /** Stroke width in screen px. Default 1. */
  lineWidth?: number;
}
