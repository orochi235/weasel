import type { Vec2 } from '@weasel-js/core';
import type { Outline } from './outline';

/**
 * Where a port sits on its node, in **normalized bounds coordinates**:
 * `(0, 0)` is the top-left corner of the node's AABB and `(1, 1)` the
 * bottom-right. `COMPASS` names the eight positions almost everything wants.
 *
 * Normalized rather than absolute because a node's size is authored data that
 * resize, align and distribute all write — a port fixed at an offset would
 * drift off the shape the first time one of them ran.
 */
export interface PortAnchor {
  u: number;
  v: number;
}

/** One attachment point declared on a node. */
export interface PortSpec {
  /** Unique within the node. Edges name this, so it outlives a re-layout. */
  id: string;
  at: PortAnchor;
  /** Consulted by a connect gesture's validity predicate. Uninterpreted here. */
  type?: string;
  /** The direction an edge leaves along, overriding the one the anchor
   *  implies. `null` means "no preferred direction" — a router goes straight
   *  at it. */
  normal?: Vec2 | null;
}

/**
 * The trait that makes an existing scene node a diagram participant.
 *
 * Attached to a node's `data`, not a node kind the plugin mints: a text block,
 * an image, a path, a group or a plain rect all take part by carrying this,
 * and nothing has to be authored through this package to be connectable.
 */
export interface DiagramNode {
  /** Defaults to {@link DEFAULT_PORTS} — the four edge midpoints of the
   *  node's own bounds, which every node has. */
  ports?: readonly PortSpec[];
  /** Layout must not move this node. */
  pinned?: boolean;
  /** What the node is *drawn* as. Present on a built body; absent on a
   *  participant that already had a look of its own — a text block, an image,
   *  a path — which keeps whatever painter it already matched. */
  outline?: Outline;
}

/** A port resolved against a node's current pose: where it is in world
 *  coordinates, and which way an edge leaves it. */
export interface Port {
  id: string;
  /** The node this port belongs to. */
  nodeId: string;
  /** World point an edge attaches to. */
  point: Vec2;
  /** Unit vector pointing away from the node, or `null` when the port
   *  declared no direction. Rotated with the node. */
  normal: Vec2 | null;
  type?: string;
}
