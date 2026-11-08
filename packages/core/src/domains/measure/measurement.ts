import type { Node, NodeId, RectPose } from 'core/scene/types';
import { sceneMagnification, type ScopedScene } from 'core/scene/unitScopes';
import { rectBetween, type Point } from '@weasel-js/geom';

/** A world-space point. */
export type MeasurePoint = Point;

/**
 * The frame each end of a measurement landed in: the node declaring a unit
 * scope it was placed inside (`unitFrameAt`), or `null` for the top of the
 * tree. The measurement reads in the scope chain the two frames share, so ends
 * in one frame, or in frames declaring equal scopes, read that frame's
 * modeled length, and ends whose frames disagree read the innermost frame
 * holding both, which is world when only the root does.
 */
export interface MeasureFrames {
  readonly start: NodeId | null;
  readonly end: NodeId | null;
}

/**
 * The offset from `start` to `end`, in world units. `dx` and `dy` are on the
 * world's own axes, where y grows downward; `angle` reads like a protractor
 * instead, counterclockwise-positive on screen, so a line rising up and to
 * the right at 30° reads +30°. The canvas's own rotations are
 * clockwise-positive: a rotate that follows the line turns by `-angle`.
 */
export interface Measurement {
  readonly start: MeasurePoint;
  readonly end: MeasurePoint;
  readonly dx: number;
  readonly dy: number;
  readonly distance: number;
  /** `atan2(-dy, dx)`, in `(-π, π]`. Zero for a zero-length measurement. */
  readonly angle: number;
  /** The frames its ends landed in. Absent, it reads in world. */
  readonly frames?: MeasureFrames;
}

/** Measure from `start` to `end`, landed in `frames`. */
export function measureBetween(start: MeasurePoint, end: MeasurePoint, frames?: MeasureFrames): Measurement {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    dx,
    dy,
    distance: Math.hypot(dx, dy),
    // `|| 0` drops the sign of a negated zero, which would read a leftward line as -π.
    angle: dx === 0 && dy === 0 ? 0 : Math.atan2(-dy || 0, dx),
    ...(frames ? { frames: { start: frames.start, end: frames.end } } : {}),
  };
}

/** How large the frame `frames` share is drawn in world: a measurement's
 *  world lengths divided by it are its modeled lengths. 1 without frames. */
export function measureMagnification(scene: ScopedScene, frames: MeasureFrames | undefined): number {
  if (!frames || frames.start === null || frames.end === null) return 1;
  return sceneMagnification(scene, [frames.start, frames.end], { inclusive: true });
}

/** What a measurement node keeps in `data`: its two ends, in world units, and
 *  the frames they landed in. A `label` beside it names the node in a layer
 *  list. */
export interface MeasureData {
  measure: { start: MeasurePoint; end: MeasurePoint; frames?: MeasureFrames };
  label?: string;
}

/** Where an end placed at a world point lands: what `unitFrameAt` builds. */
export type MeasureFrameAt = (p: MeasurePoint) => NodeId | null;

/** Which end of a measurement. */
export type MeasureEnd = 'start' | 'end';


/** The ends `node` measures between, or null when it is not a measurement. */
export function measureEndsOf(node: Pick<Node<unknown, string, unknown>, 'data'> | undefined): MeasureData['measure'] | null {
  const m = (node?.data as Partial<MeasureData> | null | undefined)?.measure;
  if (!m || typeof m !== 'object' || !m.start || !m.end) return null;
  return m;
}

/** The measurement `node` holds, or null when it is not one. */
export function measurementOf(node: Pick<Node<unknown, string, unknown>, 'data'> | undefined): Measurement | null {
  const ends = measureEndsOf(node);
  return ends ? measureBetween(ends.start, ends.end, ends.frames) : null;
}

/** The box a measurement's pose holds: its two ends' bounds, which is what
 *  culling, area queries, and fitting the view read. */
export function measurePose(start: MeasurePoint, end: MeasurePoint): RectPose {
  return rectBetween(start.x, start.y, end.x, end.y);
}

/** A measurement node on `layer`, ready to insert. */
export function measureNode(
  id: NodeId,
  layer: string,
  start: MeasurePoint,
  end: MeasurePoint,
  frames?: MeasureFrames,
): Node<unknown, string, unknown> {
  const data: MeasureData = { measure: { start: { ...start }, end: { ...end }, ...(frames ? { frames: { ...frames } } : {}) } };
  return { id, kind: 'mark', layer, parent: null, pose: measurePose(start, end), data };
}

/** `node`'s data and pose with its `which` end moved to `to`, landed in
 *  `frame`. Without `frame` the end keeps the one it had. */
export function withMeasureEnd(
  node: Node<unknown, string, unknown>,
  which: MeasureEnd,
  to: MeasurePoint,
  frame?: NodeId | null,
): { data: MeasureData; pose: RectPose } | null {
  const ends = measureEndsOf(node);
  if (!ends) return null;
  const next = { ...ends, [which]: { x: to.x, y: to.y } };
  if (frame !== undefined) next.frames = { start: ends.frames?.start ?? null, end: ends.frames?.end ?? null, [which]: frame };
  const data: MeasureData = { ...(node.data as MeasureData), measure: next };
  return { data, pose: measurePose(next.start, next.end) };
}
