/**
 * Where a node's ports are, in world coordinates.
 *
 * A port is placed in the node's **unrotated** bounds, then carried through
 * the pose's rotation — the same pivot every other kit reader uses, the AABB
 * center. Bounds come from the pose descriptor rather than from `pose.width`
 * and friends, so a node whose pose is a path, an ellipse or anything else a
 * consumer wired is connectable on the same terms as a rect.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  rotatePoint,
  type PoseProjection,
  type Vec2,
} from '@weasel-js/core';
import { outlinePolyline, rayHit } from './onOutline';
import { diagramNodeOf, type DiagramNodeLike, type DiagramNodeReader } from './trait';
import type { Port, PortAnchor, PortSpec } from './types';

/** The eight anchors almost everything wants, named the way a compass is. */
export const COMPASS = {
  nw: { u: 0, v: 0 },
  n: { u: 0.5, v: 0 },
  ne: { u: 1, v: 0 },
  e: { u: 1, v: 0.5 },
  se: { u: 1, v: 1 },
  s: { u: 0.5, v: 1 },
  sw: { u: 0, v: 1 },
  w: { u: 0, v: 0.5 },
} as const satisfies Record<string, PortAnchor>;

/**
 * What a node carrying no `ports` gets: the four edge midpoints of its own
 * bounds. Every node has bounds, so every node is connectable without saying
 * anything.
 */
export const DEFAULT_PORTS: readonly PortSpec[] = Object.freeze([
  { id: 'n', at: COMPASS.n },
  { id: 'e', at: COMPASS.e },
  { id: 's', at: COMPASS.s },
  { id: 'w', at: COMPASS.w },
]);

export interface PortsOptions<TPose> {
  /** Reads the AABB a port is placed in, and the node's rotation. Defaults to
   *  the kit's `AUTO_POSE_DESCRIPTOR`, which handles rect and path poses. */
  geometry?: PoseProjection<TPose>;
  /** How the `DiagramNode` trait is read off a node. */
  read?: DiagramNodeReader;
}

/**
 * The direction the anchor implies: away from the center of the bounds.
 *
 * `(2u-1, 2v-1)` is the anchor in a box that runs -1..1, which is exactly that
 * direction — an edge midpoint gets the axis-aligned normal, a corner gets the
 * diagonal. It is deliberately not scaled by the node's aspect: this is a
 * heading a router leaves along, not a point on the outline. A port at the
 * dead center has no direction, and says so.
 */
function normalOf(at: PortAnchor): Vec2 | null {
  const x = at.u * 2 - 1;
  const y = at.v * 2 - 1;
  const len = Math.hypot(x, y);
  if (len === 0) return null;
  return { x: x / len, y: y / len };
}

/**
 * Every port on `node`, resolved against `pose`.
 *
 * Pass the pose the node is **painted** at — `effectivePose(scene, node)` —
 * not `node.pose`. A port that answers from the document pose while the node
 * is mid-drag puts an edge somewhere the user can see the node is not.
 */
export function portsOf<TPose>(
  node: DiagramNodeLike,
  pose: TPose,
  opts: PortsOptions<TPose> = {},
): Port[] {
  const trait = diagramNodeOf(node, opts.read);
  if (trait === null) return [];
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseProjection<TPose>);
  const bounds = geometry.getBounds(pose);
  const rotation = geometry.getRotation?.(pose) ?? 0;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  // A port is anchored in the bounds so it survives a resize, but it has to
  // *sit* on the shape: a parallelogram's west anchor is in the gap beside its
  // leaning edge, and an edge ending there ends in empty space. Flattened once
  // per call, not once per port.
  const poly = trait.outline === undefined || bounds.width <= 0 || bounds.height <= 0
    ? null
    : outlinePolyline(trait.outline, bounds);

  return (trait.ports ?? DEFAULT_PORTS).map((spec) => {
    const anchored: Vec2 = {
      x: bounds.x + spec.at.u * bounds.width,
      y: bounds.y + spec.at.v * bounds.height,
    };
    const flat = (poly === null ? null : rayHit(poly, { x: cx, y: cy }, anchored)) ?? anchored;
    const normal = spec.normal === undefined ? normalOf(spec.at) : spec.normal;
    if (rotation === 0) {
      return { id: spec.id, nodeId: node.id, point: flat, normal, ...typeOf(spec) };
    }
    return {
      id: spec.id,
      nodeId: node.id,
      point: rotatePoint(flat.x, flat.y, cx, cy, rotation),
      // A direction rotates about the origin, not about the node's center.
      normal: normal === null ? null : rotatePoint(normal.x, normal.y, 0, 0, rotation),
      ...typeOf(spec),
    };
  });
}

/** One named port, or `undefined` when the node has no such port. */
export function portOf<TPose>(
  node: DiagramNodeLike,
  pose: TPose,
  portId: string,
  opts: PortsOptions<TPose> = {},
): Port | undefined {
  return portsOf(node, pose, opts).find((p) => p.id === portId);
}

/** Spread rather than assigned, so a port with no type has no `type` key at
 *  all — `exactOptionalPropertyTypes` rejects an explicit `undefined`. */
function typeOf(spec: PortSpec): { type?: string } {
  return spec.type === undefined ? {} : { type: spec.type };
}
