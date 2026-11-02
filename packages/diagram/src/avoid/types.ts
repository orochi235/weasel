/**
 * What the obstacle-avoiding router reads and answers. Plain data: it knows
 * nothing of scenes, so a host with its own nodes routes with it directly.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { DiagramLabel } from '../labelTrait';
import type { Bounds } from '../outline';

/** An axis-aligned box in world units. */
export type Box = Bounds;

/** A place a connector's end may leave or arrive: a port's point and the
 *  unit direction it faces away from its shape. */
export interface AvoidPort {
  point: Vec2;
  normal: Vec2;
}

/** One end of a connector: the shape it is on, and the ports it may use.
 *  An end glued to a shape rather than to one port offers every port. */
export interface AvoidEnd {
  node: string;
  ports: readonly AvoidPort[];
}

/** A connector to route. */
export interface AvoidEdge {
  id: string;
  from: AvoidEnd;
  to: AvoidEnd;
  /** The author's stops between the ends, passed in order. */
  waypoints?: readonly Vec2[];
  /** The route it holds now: the bends between its ends. */
  route?: readonly Vec2[];
  /** Its label, which every other connector routes around. The router
   *  stations it on this connector's route as `labelCenter` does. */
  label?: AvoidLabel;
}

/** A connector's label as the router reads it: where along the route it
 *  sits, and how big it is. */
export interface AvoidLabel {
  id: string;
  placement: DiagramLabel;
  size: { width: number; height: number };
}

/**
 * Something connectors route around.
 *
 * - `shape` blocks every connector beyond its own port stubs.
 * - `region` (a container or pool) blocks a connector only when neither of
 *   its ends is one of `members`.
 * - `label` blocks every connector but `edge`, the one it labels.
 */
export interface AvoidObstacle {
  id: string;
  box: Box;
  kind: 'shape' | 'region' | 'label';
  /** For a region: the shapes inside it, at any depth. */
  members?: ReadonlySet<string>;
  /** For a label: the connector it labels. */
  edge?: string;
}

/** What one update reads: every obstacle and every connector there is now. */
export interface AvoidInput {
  obstacles: readonly AvoidObstacle[];
  edges: readonly AvoidEdge[];
}

/** How the router routes. Every field has a default. */
export interface AvoidOptions {
  /** How far a route keeps from every obstacle, in world units. Default 10. */
  clearance?: number;
  /** Cost of one turn, in world units of length. Default 40. */
  bendPenalty?: number;
  /** Cost of crossing another connector's route. Default 20. */
  crossPenalty?: number;
  /** Distance between parallel runs after nudging. Default 8. */
  spacing?: number;
  /** How far past a leg's stops the search first looks; it doubles while no
   *  path fits. Default 100. */
  margin?: number;
  /** How far a route keeps from another connector's label. Default 4. */
  labelClearance?: number;
}

/** {@link AvoidOptions} with every default filled in. */
export type ResolvedAvoidOptions = Required<AvoidOptions>;

/** The defaults behind {@link AvoidOptions}. */
export const AVOID_DEFAULTS: ResolvedAvoidOptions = Object.freeze({
  clearance: 10,
  bendPenalty: 40,
  crossPenalty: 20,
  spacing: 8,
  margin: 100,
  labelClearance: 4,
});

/** `box` grown by `by` on every side. */
export const inflate = (box: Box, by: number): Box =>
  ({ x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by });

/** A connector as {@link blocks} reads it: its id and the shapes it joins. */
export interface BlockedEdge {
  id: string;
  from: { node: string };
  to: { node: string };
}

/** Whether `obstacle` blocks connector `edge`. */
export function blocks(obstacle: AvoidObstacle, edge: BlockedEdge): boolean {
  if (obstacle.kind === 'shape') return true;
  if (obstacle.kind === 'label') return obstacle.edge !== edge.id;
  const members = obstacle.members;
  return members === undefined || (!members.has(edge.from.node) && !members.has(edge.to.node));
}
