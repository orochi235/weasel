/**
 * What a connect may run from and land on: a port, or a participant's body.
 *
 * A body end is Visio's dynamic glue. It names the shape and not a port, and
 * the edge resolves to whichever port faces the other end each time it is
 * routed (`resolveEnd`), so it follows the shape around as things move.
 */
import { refusalOf, type DerivedDep, type DropVerdict, type OngoingOverlay } from '@weasel-js/core';
import {
  AUTO_POSE_DESCRIPTOR,
  rotatePoint,
  type PoseDescriptor,
  type Vec2,
} from '@weasel-js/core/math';
import { pathContainsPoint } from '@weasel-js/geom';
import { boxCenter, endAims, resolveEnd, type Router } from './edge';
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

/** A refused end's marks: its shape's box outlined refused, and the reason at the pointer. */
function refusalMarks(box: { x: number; y: number; width: number; height: number } | null, at: Vec2, reason: string): OngoingOverlay[] {
  const out: OngoingOverlay[] = [];
  if (box !== null) {
    const { x, y, width, height } = box;
    out.push({ kind: 'polyline', points: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }], role: 'refused' });
  }
  out.push({ kind: 'reason', at: { x: at.x, y: at.y }, text: reason });
  return out;
}

/** What {@link createTargets} needs from the connect action's options. */
export interface TargetOptions<TPose> extends PortsOptions<TPose> {
  participants: ParticipantSource<TPose>;
  /** Asked with the end that stays put first, and the candidate second. */
  canConnect: (fixed: ConnectEnd, candidate: ConnectEnd) => DropVerdict;
  showsPort?: (port: Port) => boolean;
  snapRadius: number;
  bodies: boolean;
}

/** What the pointer is over: an end a connect may land on, or one that
 *  refuses it with `refuse`, the reason. */
export interface Landing {
  end: ConnectEnd;
  refuse: string | null;
}

/** One resolver for what a connect lands on, and the port each end is drawn
 *  to, shared by the preview and the commit, with what it paints on the way. */
export function createTargets<TPose>(opts: TargetOptions<TPose>) {
  const resolver = createResolver(opts);
  const { landing, preview, boxOf } = resolver;

  /**
   * What a connect paints with the pointer at `at`: the run `preview` routes,
   * as a connector, or over an end that refuses it, refused, with that end's
   * shape outlined refused and the reason at the pointer.
   */
  function overlays(
    route: Router,
    fixed: ConnectEnd,
    at: Vec2,
    view: ConnectView,
    moving: 'from' | 'to' = 'to',
    waypoints: readonly Vec2[] = [],
  ): OngoingOverlay[] {
    const points = preview(route, fixed, at, view, moving, waypoints);
    const hit = landing(fixed, at, view);
    const run: OngoingOverlay[] = points.length < 2 ? [] : [{ kind: 'polyline', points, role: hit?.refuse != null ? 'refused' : 'connector' }];
    if (hit === null || hit.refuse === null) return run;
    return [...run, ...refusalMarks(boxOf(hit.end.nodeId), at, hit.refuse)];
  }

  return { ...resolver, overlays };
}

function createResolver<TPose>(opts: TargetOptions<TPose>) {
  const portOpts: PortsOptions<TPose> = {
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    ...(opts.read ? { read: opts.read } : {}),
  };
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);

  /** The nearest port in reach that `canConnect` does not silently turn away, or `null`. */
  function portTarget(from: ConnectEnd, at: Vec2, view: ConnectView): Landing | null {
    let best: Landing | null = null;
    let bestD2 = opts.snapRadius * opts.snapRadius;
    for (const participant of opts.participants()) {
      if (!offersPorts(participant, view)) continue;
      for (const port of portsOf(participant.node, participant.pose, portOpts)) {
        if (opts.showsPort !== undefined && !opts.showsPort(port)) continue;
        const d2 = (port.point.x - at.x) ** 2 + (port.point.y - at.y) ** 2;
        if (d2 > bestD2) continue;
        const verdict = opts.canConnect(from, port);
        if (verdict === false) continue;
        bestD2 = d2;
        best = { end: port, refuse: refusalOf(verdict) };
      }
    }
    return best;
  }

  /** What the pointer at `at` is over: a port in reach beats the body under
   *  it. A body with no ports is nothing, since an edge glued to it has
   *  nothing to route to. */
  function landing(from: ConnectEnd, at: Vec2, view: ConnectView): Landing | null {
    const port = portTarget(from, at, view);
    if (port !== null || !opts.bodies) return port;
    const body = bodyAt(opts.participants, at, { ...portOpts, view });
    if (body === null || portsOf(body.participant.node, body.participant.pose, portOpts).length === 0) return null;
    const verdict = opts.canConnect(from, body.end);
    return verdict === false ? null : { end: body.end, refuse: refusalOf(verdict) };
  }

  /** What a release at `at` lands on, or `null` where nothing may land. */
  function target(from: ConnectEnd, at: Vec2, view: ConnectView): ConnectEnd | null {
    const hit = landing(from, at, view);
    return hit === null || hit.refuse !== null ? null : hit.end;
  }

  function participantOf(nodeId: string): ParticipantPose<TPose> | undefined {
    for (const participant of opts.participants()) {
      if (participant.node.id === nodeId) return participant;
    }
    return undefined;
  }

  /** The center an end is aimed by, as the edge router takes it: its node's,
   *  else its own point. */
  function centerOf(end: ConnectEnd): Vec2 {
    const participant = participantOf(end.nodeId);
    return participant === undefined ? end.point : boxCenter(geometry, participant.pose);
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

  /**
   * The run an edge would take with `fixed` at one end and the other released
   * at `at`: snapped to the target there, else to the bare point, which as a
   * port with no facing a router aims straight at. `moving` says which end of
   * the edge the pointer carries, so the run is routed in the edge's direction,
   * through `waypoints` in that direction, each end aimed as `endAims` aims a
   * committed edge's.
   */
  function preview(
    route: Router,
    fixed: ConnectEnd,
    at: Vec2,
    view: ConnectView,
    moving: 'from' | 'to' = 'to',
    waypoints: readonly Vec2[] = [],
  ): readonly Vec2[] {
    const landed = landing(fixed, at, view)?.end ?? null;
    const [fixedCenter, landedCenter] = [centerOf(fixed), landed === null ? at : centerOf(landed)];
    const aims = moving === 'to'
      ? endAims(fixedCenter, landedCenter, waypoints)
      : endAims(landedCenter, fixedCenter, waypoints);
    const [fixedAim, landedAim] = moving === 'to' ? [aims.from, aims.to] : [aims.to, aims.from];
    const free = landed === null
      ? { id: '', nodeId: '', point: at, normal: null }
      : portFor(landed, landedAim);
    const anchored = portFor(fixed, fixedAim);
    if (free === null || anchored === null) return [];
    return moving === 'to'
      ? route({ from: anchored, to: free, waypoints })
      : route({ from: free, to: anchored, waypoints });
  }

  /** The world box of `nodeId`'s participant, or `null`. */
  function boxOf(nodeId: string): { x: number; y: number; width: number; height: number } | null {
    const participant = participantOf(nodeId);
    return participant === undefined ? null : geometry.getBounds(participant.pose);
  }

  return { target, landing, portFor, preview, boxOf };
}

