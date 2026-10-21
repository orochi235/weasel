/**
 * Reconnect — dragging a selected edge's end onto another port or shape.
 *
 * The edge-end handles (`edgeEndLayer`) claim the press; this action carries
 * the end. It lands where a connect from the edge's other end would land, by
 * the same resolver and the same `canConnect`, asked with the edge's from/to
 * order kept, so a reconnect can never make an edge a connect could not.
 */
import type {
  Action,
  Contribution,
  GestureBinding,
  InvocationCtx,
  OngoingHandle,
  OngoingOverlay,
  RenderLayer,
  Vec2,
} from '@weasel-js/core';
import {
  defaultCanConnect,
  edgeEndOf,
  grabPortAction,
  grabPortBindings,
  type ConnectActionOptions,
  type MovingEnd,
} from './connect';
import { createTargets, isBodyEnd, type ConnectEnd } from './connectTargets';
import { routerOf, type Router } from './edge';
import {
  EDGE_END_AFFORDANCE_KIND,
  EDGE_END_LAYER_ID,
  createEdgeEnds,
  edgeEndLayer,
  edgeEndScratchOf,
  type EdgeEndAffordanceOptions,
  type EdgeEnds,
} from './edgeEndLayer';
import { diagramEdgeOf } from './edgeTrait';
import { portOf } from './ports';

export { EDGE_END_LAYER_ID };

/** The action that drags an edge end onto a new port or body. */
export const RECONNECT_ACTION_ID = 'diagram.reconnect';
/** The action id that absorbs a press on an edge-end handle. */
export const GRAB_EDGE_END_ACTION_ID = 'diagram.grabEdgeEnd';

/** One end of one edge, moved onto `target`. */
export interface EndChange {
  edgeId: string;
  end: 'from' | 'to';
  target: ConnectEnd;
}

/** Options for {@link createReconnectAction}. `bodies` defaults to true: an end
 *  may be dropped on a shape's body. */
export interface ReconnectOptions<TPose> extends Omit<ConnectActionOptions<TPose>, 'commit' | 'startFrom'> {
  /** The selected edge ids whose ends show handles. */
  selected: () => readonly string[];
  /** Defaults to {@link commitReconnectToScene} against `deps.scene`. */
  commit?: (change: EndChange, ctx: InvocationCtx) => void;
}

const DEFAULT_SNAP = 16;

/**
 * The default commit: rewrites the moved end in `data.diagram` — `{ port }`,
 * or `{}` for a body — and points the edge's `dependsOn` at the new node, as
 * one history entry.
 */
export function commitReconnectToScene(change: EndChange, ctx: InvocationCtx): void {
  const scene = ctx.deps.scene;
  if (scene === undefined) return;
  const node = scene.get(change.edgeId as never);
  const trait = node === undefined ? null : diagramEdgeOf(node);
  const deps = node?.dependsOn;
  if (node === undefined || trait === null || !Array.isArray(deps) || deps.length !== 2) return;
  const data = node.data as Record<string, unknown>;
  const nextDeps = [...deps];
  nextDeps[change.end === 'from' ? 0 : 1] = change.target.nodeId as never;
  scene.batch('Reconnect edge', () => {
    scene.update(node.id, {
      data: { ...data, diagram: { ...trait, [change.end]: edgeEndOf(change.target) } } as never,
    });
    scene.setDependsOn(node.id, nextDeps);
  });
}

/** The end of `ends` that stays put while `moving` is dragged: its named
 *  port, else its body. */
function fixedEndOf<TPose>(ends: EdgeEnds<TPose>, moving: 'from' | 'to', opts: ReconnectOptions<TPose>): ConnectEnd {
  const side = moving === 'from' ? 'to' : 'from';
  const { node, pose } = ends[side];
  const named = ends.trait[side].port;
  const port = named === undefined ? undefined : portOf(node, pose, named, {
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    ...(opts.read ? { read: opts.read } : {}),
  });
  return port ?? { kind: 'body', nodeId: node.id, point: ends.points[side] };
}

/** Whether `target` is the end the edge already has. */
function sameEnd(ends: EdgeEnds<unknown>, moving: 'from' | 'to', target: ConnectEnd): boolean {
  if (ends[moving].node.id !== target.nodeId) return false;
  const named = ends.trait[moving].port;
  return isBodyEnd(target) ? named === undefined : named === target.id;
}

interface ReconnectScratch {
  edgeId: string;
  moving: 'from' | 'to';
  fixed: ConnectEnd;
  ends: EdgeEnds<unknown>;
  route: Router;
  current: Vec2;
  open: boolean;
  /** The deps bag from `start`; later pump events carry an empty one. */
  deps: InvocationCtx['deps'];
}

/** The `diagram.reconnect` action: an ongoing drag carrying one edge end. */
export function createReconnectAction<TPose>(opts: ReconnectOptions<TPose>): Action {
  const { canConnect = defaultCanConnect, commit = commitReconnectToScene } = opts;
  const endsOf = createEdgeEnds(opts.participants, opts);
  const shared = { ...opts, snapRadius: opts.snapRadius ?? DEFAULT_SNAP, bodies: opts.bodies ?? true };
  // The resolver asks `canConnect(fixed, candidate)`; a moved `from` end
  // swaps them back so the policy sees the edge's own direction.
  const targetsFor = (moving: MovingEnd) => createTargets({
    ...shared,
    canConnect: moving.end === 'to'
      ? (fixed, candidate) => canConnect(fixed, candidate, moving)
      : (fixed, candidate) => canConnect(candidate, fixed, moving),
  });

  return {
    id: opts.id ?? RECONNECT_ACTION_ID,
    label: 'Reconnect',
    group: 'diagram',
    requires: ['scene', 'view'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const pressed = edgeEndScratchOf(ctx.drag?.affordance);
        const ends = pressed === null ? null : endsOf(pressed.edgeId);
        if (pressed === null || ends === null) return {};
        const scratch: ReconnectScratch = {
          edgeId: pressed.edgeId,
          moving: pressed.end,
          fixed: fixedEndOf(ends, pressed.end, opts),
          ends: ends as EdgeEnds<unknown>,
          route: routerOf(ends.trait, opts.routers),
          current: { x: ctx.world.x, y: ctx.world.y },
          open: true,
          deps: ctx.deps,
        };
        const resolver = targetsFor({ edge: scratch.edgeId, end: scratch.moving });

        return {
          kind: 'diagram-reconnect',
          onMove(moveCtx: InvocationCtx): void {
            scratch.current = { x: moveCtx.world.x, y: moveCtx.world.y };
          },
          overlay(): OngoingOverlay | null {
            if (!scratch.open) return null;
            const points = resolver.preview(scratch.route, scratch.fixed, scratch.current, scratch.deps.view, scratch.moving, scratch.ends.trait.waypoints);
            return points.length < 2 ? null : { kind: 'polyline', points, role: 'connector' };
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            scratch.open = false;
            if (reason === 'cancel') return;
            const target = resolver.target(scratch.fixed, { x: endCtx.world.x, y: endCtx.world.y }, scratch.deps.view);
            if (target === null || sameEnd(scratch.ends, scratch.moving, target)) return;
            commit({ edgeId: scratch.edgeId, end: scratch.moving, target }, { ...endCtx, deps: scratch.deps });
          },
        };
      },
    },
    enabled: () => true as const,
  };
}

/** The binding that starts a reconnect: a drag pressed on an edge-end handle. */
export function reconnectBinding(actionId: string = RECONNECT_ACTION_ID): GestureBinding {
  return { spec: { kind: 'drag', target: `affordance:${EDGE_END_AFFORDANCE_KIND}` }, actionId, opts: { id: `${actionId}.drag` } };
}

/**
 * Both halves of reconnect: the handle layer to `registerLayer` — after the
 * port layer, since an edge's end sits on a port — and the contribution to
 * pass as `ambient`. Like `diagramPorts`, one without the other fails quietly.
 */
export function diagramEdgeEnds<TPose>(
  opts: ReconnectOptions<TPose> & Omit<EdgeEndAffordanceOptions<TPose>, 'id'>,
): { layer: RenderLayer<unknown>; contribution: Contribution } {
  const actionId = opts.id ?? RECONNECT_ACTION_ID;
  return {
    // `opts.id` names the action; the layer keeps its own id.
    layer: edgeEndLayer(opts.participants, opts.selected, { ...opts, id: EDGE_END_LAYER_ID }),
    contribution: {
      id: 'weasel-diagram-edge-ends',
      eligibility: { claimed: true },
      actions: [createReconnectAction({ ...opts, id: actionId }), grabPortAction(GRAB_EDGE_END_ACTION_ID)],
      bindings: [
        reconnectBinding(actionId),
        ...grabPortBindings(GRAB_EDGE_END_ACTION_ID, EDGE_END_AFFORDANCE_KIND),
      ],
    },
  };
}
