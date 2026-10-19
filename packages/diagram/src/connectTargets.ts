/**
 * What a connect may run from and land on: a port, or a participant's body.
 *
 * A body end is Visio's dynamic glue. It names the shape and not a port, and
 * the edge resolves to whichever port faces the other end each time it is
 * routed (`resolveEnd`), so it follows the shape around as things move.
 */
import type { DerivedDep } from '@weasel-js/core';
import {
  AUTO_POSE_DESCRIPTOR,
  rotatePoint,
  type PoseDescriptor,
  type Vec2,
} from '@weasel-js/core/math';
import { pathContainsPoint } from '@weasel-js/geom';
import { resolveEnd, type Router } from './edge';
import { diagramEdgeOf } from './edgeTrait';
import { diagramGroupOf } from './group';
import { diagramLabelOf } from './labelTrait';
import { outlinePath } from './outline';
import { offersPorts, type ParticipantPose, type ParticipantSource } from './portAffordance';
import { portsOf, type PortsOptions } from './ports';
import { diagramNodeOf } from './trait';
import type { Port } from './types';

/** An end on a participant's body rather than on one of its ports. `point` is
 *  where the pointer was, in world coordinates. */
export interface BodyEnd {
  kind: 'body';
  nodeId: string;
  point: Vec2;
}

/** Either end of a connect. */
export type ConnectEnd = Port | BodyEnd;

/** Whether a connect end lands on a node's body rather than a port. */
export function isBodyEnd(end: ConnectEnd): end is BodyEnd {
  return (end as { kind?: unknown }).kind === 'body';
}

/** A body under the pointer, and the participant it belongs to. */
export interface BodyHit<TPose> {
  end: BodyEnd;
  participant: ParticipantPose<TPose>;
}

/** The view a connect started in, which decides what layers it may reach. */
export type ConnectView = Parameters<typeof offersPorts>[1];

/**
 * The topmost participant whose body contains `at`, or `null`.
 *
 * Its outline when it declares one, else its bounds, both taken in the pose's
 * unrotated frame. Edges, edge labels and group boxes are not bodies, and nor
 * is anything the reader does not take as a participant or that `offersPorts`
 * turns away.
 */
export function bodyAt<TPose>(
  participants: ParticipantSource<TPose>,
  at: Vec2,
  opts: PortsOptions<TPose> & { view?: ConnectView } = {},
): BodyHit<TPose> | null {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  let hit: BodyHit<TPose> | null = null;
  // Render order, so the last match is the one drawn on top.
  for (const participant of participants()) {
    const { node } = participant;
    if (!offersPorts(participant, opts.view)) continue;
    if (diagramEdgeOf(node) !== null || diagramLabelOf(node) !== null || diagramGroupOf(node) !== null) continue;
    const trait = diagramNodeOf(node, opts.read);
    if (trait === null || trait.group !== undefined) continue;
    const bounds = geometry.getBounds(participant.pose);
    if (bounds.width <= 0 || bounds.height <= 0) continue;
    const rotation = geometry.getRotation?.(participant.pose) ?? 0;
    const local = rotation === 0
      ? at
      : rotatePoint(at.x, at.y, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, -rotation);
    const inside = trait.outline === undefined
      ? local.x >= bounds.x && local.x <= bounds.x + bounds.width
        && local.y >= bounds.y && local.y <= bounds.y + bounds.height
      : pathContainsPoint(outlinePath(trait.outline, bounds), local.x, local.y);
    if (inside) hit = { end: { kind: 'body', nodeId: node.id, point: { x: at.x, y: at.y } }, participant };
  }
  return hit;
}

/** What {@link createTargets} needs from the connect action's options. */
export interface TargetOptions<TPose> extends PortsOptions<TPose> {
  participants: ParticipantSource<TPose>;
  canConnect: (from: ConnectEnd, to: ConnectEnd) => boolean;
  showsPort?: (port: Port) => boolean;
  snapRadius: number;
  bodies: boolean;
}

/** One resolver for what a connect lands on, and the port each end is drawn
 *  to, shared by the preview and the commit. */
export function createTargets<TPose>(opts: TargetOptions<TPose>) {
  const portOpts: PortsOptions<TPose> = {
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    ...(opts.read ? { read: opts.read } : {}),
  };
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);

  /** The port the pointer is over and may legally land on, or `null`. */
  function portTarget(from: ConnectEnd, at: Vec2, view: ConnectView): Port | null {
    let best: Port | null = null;
    let bestD2 = opts.snapRadius * opts.snapRadius;
    for (const participant of opts.participants()) {
      if (!offersPorts(participant, view)) continue;
      for (const port of portsOf(participant.node, participant.pose, portOpts)) {
        if (opts.showsPort !== undefined && !opts.showsPort(port)) continue;
        if (!opts.canConnect(from, port)) continue;
        const d2 = (port.point.x - at.x) ** 2 + (port.point.y - at.y) ** 2;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = port;
        }
      }
    }
    return best;
  }

  /** What a release at `at` lands on: a port in reach beats the body under it. */
  function target(from: ConnectEnd, at: Vec2, view: ConnectView): ConnectEnd | null {
    const port = portTarget(from, at, view);
    if (port !== null || !opts.bodies) return port;
    const body = bodyAt(opts.participants, at, { ...portOpts, view });
    return body !== null && opts.canConnect(from, body.end) ? body.end : null;
  }

  function participantOf(nodeId: string): ParticipantPose<TPose> | undefined {
    for (const participant of opts.participants()) {
      if (participant.node.id === nodeId) return participant;
    }
    return undefined;
  }

  function centerOf(nodeId: string): Vec2 | undefined {
    const participant = participantOf(nodeId);
    if (participant === undefined) return undefined;
    const b = geometry.getBounds(participant.pose);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  /** The port an end is drawn to: itself, or for a body, the port facing
   *  `toward` — the one the committed edge will resolve to. */
  function portFor(end: ConnectEnd, toward: Vec2): Port | null {
    if (!isBodyEnd(end)) return end;
    const participant = participantOf(end.nodeId);
    if (participant === undefined) return null;
    const dep = { node: participant.node, pose: participant.pose } as unknown as DerivedDep<TPose>;
    const all = (d: DerivedDep<TPose>): Port[] => portsOf(d.node as never, d.pose, portOpts);
    return resolveEnd({}, dep, toward, portOpts, all) ?? null;
  }

  /** Where an end aims the other: its node's center, as the edge router uses,
   *  or the bare point for a free end. */
  function aimOf(end: ConnectEnd | null, free: Vec2): Vec2 {
    if (end === null) return free;
    return centerOf(end.nodeId) ?? end.point;
  }

  /**
   * The run an edge would take with `fixed` at one end and the other released
   * at `at`: snapped to the target there, else to the bare point, which as a
   * port with no facing a router aims straight at. `moving` says which end of
   * the edge the pointer carries, so the run is routed in the edge's direction,
   * through `waypoints` in that direction.
   */
  function preview(
    route: Router,
    fixed: ConnectEnd,
    at: Vec2,
    view: ConnectView,
    moving: 'from' | 'to' = 'to',
    waypoints: readonly Vec2[] = [],
  ): readonly Vec2[] {
    const landed = target(fixed, at, view);
    const free = landed === null
      ? { id: '', nodeId: '', point: at, normal: null }
      : portFor(landed, aimOf(fixed, at));
    const anchored = portFor(fixed, aimOf(landed, at));
    if (free === null || anchored === null) return [];
    return moving === 'to'
      ? route({ from: anchored, to: free, waypoints })
      : route({ from: free, to: anchored, waypoints });
  }

  return { target, portFor, aimOf, preview };
}
