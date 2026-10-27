import type { Node, NodeId, RectPose } from 'core/scene/types';
import type { Point } from '@weasel-js/geom';

/** A world-space point. */
export type MeasurePoint = Point;

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
}

/** Measure from `start` to `end`. */
export function measureBetween(start: MeasurePoint, end: MeasurePoint): Measurement {
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
  };
}

/** What a measurement node keeps in `data`: its two ends, in world units. A
 *  `label` beside it names the node in a layer list. */
export interface MeasureData {
  measure: { start: MeasurePoint; end: MeasurePoint };
  label?: string;
}

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
  return ends ? measureBetween(ends.start, ends.end) : null;
}

/** The box a measurement's pose holds: its two ends' bounds, which is what
 *  culling, area queries, and fitting the view read. */
export function measurePose(start: MeasurePoint, end: MeasurePoint): RectPose {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/** A measurement node on `layer`, ready to insert. */
export function measureNode(id: NodeId, layer: string, start: MeasurePoint, end: MeasurePoint): Node<unknown, string, unknown> {
  const data: MeasureData = { measure: { start: { ...start }, end: { ...end } } };
  return { id, kind: 'mark', layer, parent: null, pose: measurePose(start, end), data };
}

/** `node`'s data and pose with its `which` end moved to `to`. */
export function withMeasureEnd(
  node: Node<unknown, string, unknown>,
  which: MeasureEnd,
  to: MeasurePoint,
): { data: MeasureData; pose: RectPose } | null {
  const ends = measureEndsOf(node);
  if (!ends) return null;
  const next = { ...ends, [which]: { x: to.x, y: to.y } };
  const data: MeasureData = { ...(node.data as MeasureData), measure: next };
  return { data, pose: measurePose(next.start, next.end) };
}
