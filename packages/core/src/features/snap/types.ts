/** The snap source contract: what a target set offers a snap session, and
 *  the marks a session draws for what it met. */

import type { ProbeRole, SnapTier } from '@weasel-js/geom/nd';
import type { Scene } from 'core/scene/types';
import type { SnapGeometry, SnapMods } from 'interactions/actions/snapDep';

type Point = { x: number; y: number };

/** The positions a target allows: `at` plus any combination of `dirs`. No
 *  dirs is a point, one a line, two a plane. */
export interface Locus<P = Point> {
  at: P;
  dirs: readonly P[];
  /** One interval per dir, in multiples of it: a segment or a bounded face. */
  span?: readonly (readonly [number, number])[];
}

/** One locus a source offers one probe. */
export interface SourceCandidate<P = Point> {
  /** The id of a probe the source was offered. */
  probe: string;
  locus: Locus<P>;
  /** The result must meet one required candidate, whatever its reach. */
  required?: boolean;
  /** Drawn when the result meets this candidate. A function is handed the
   *  resolved move, so the mark can sit where the probe landed. */
  mark?: SnapMark<P> | ((delta: P) => SnapMark<P>);
}

export type SnapGesture = 'point' | 'move' | 'resize' | 'rotate';

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
  /** Absent in a host with no 2D scene. */
  scene?: Scene<unknown, string, unknown>;
}

/** What a rotate or handle drag asks a source for. Task 8 implements the
 *  session side. */
export interface AngleCollect {
  pivot: Point;
  theta0: number;
  ids: readonly string[];
  mods: SnapMods;
}

export interface AngleCandidate {
  angle: number;
  required?: boolean;
  mark?: SnapMark;
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
  /** Default: every gesture but `'rotate'`. */
  gestures?: readonly SnapGesture[];
  collect(q: SnapCollect<P>): Iterable<SourceCandidate<P>>;
  angles?(q: AngleCollect): Iterable<AngleCandidate>;
}

/** What a session draws for a candidate the result meets. World coords. */
export type SnapMark<P = Point> =
  | { kind: 'point'; at: P; glyph: string; label?: string }
  | { kind: 'line'; from: P; to: P }
  | { kind: 'gap'; from: P; to: P; value: number }
  | { kind: 'distance'; from: P; to: P; value: number };

/** `<SceneCanvas snap>`. */
export interface SceneCanvasSnap {
  /** Sources ahead of the presets' `snapSources` and any `useSnapSource`. */
  sources?: readonly SnapSource[];
  /** The reach of a source that sets none, in screen px. Default: the kit
   *  setting `targets.snapPx`. */
  reachPx?: number;
  /** Whether the snap marks are drawn. Default `true`. */
  readout?: boolean;
}
