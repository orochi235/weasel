/**
 * The connect gesture — dragging one port onto another to author an edge.
 *
 * Connect is an ordinary drag binding, not a mode and not a tool of its own:
 * the binding is gated on a press landing on a port affordance, so a connect
 * starts from whatever tool happens to be active. The gate lives in the
 * binding's `target`, which is what lets a press that is *not* on a port fall
 * through to the tool that wants it instead of being swallowed here.
 *
 * **Where validity is decided.** The two halves are decided in different
 * places, and conflating them is the mistake this package is written to avoid:
 *
 *   - *Which presses start a connect* is routing, and belongs to the binding
 *     spec. `connectBinding` names the port layer's affordance kind; nothing in
 *     the action body re-checks what was pressed.
 *   - *Which ports a live connect may land on* cannot be routing — the
 *     dispatcher never re-reads the affordance under a moving pointer, so a
 *     spec has no vocabulary for it. It is decided by `canConnect` filtering
 *     the **candidate set**: an illegal port is never a candidate, so the
 *     preview will not snap to it and a release over it commits nothing. That
 *     is a narrower thing than an action body that inspects a hit and bails.
 *
 * One resolver answers both the live preview and the commit, for the reason
 * `insertAction` does the same: a preview computed separately from the commit
 * is a preview that can lie about what releasing will do.
 */
import {
  polylineFromPoints,
  type Action,
  type DrawCommand,
  type GestureBinding,
  type InvocationCtx,
  type OngoingHandle,
  type OngoingOverlay,
  type PoseDescriptor,
  type Scene,
  type Stroke,
  type Vec2,
} from '@weasel-js/core';
import { EDGE_DERIVE_PATH, ROUTERS, type DiagramEdge, type Router } from './edge';
import { PORT_AFFORDANCE_KIND, portScratchOf, type ParticipantSource } from './portAffordance';
import { portsOf } from './ports';
import type { DiagramNodeReader } from './trait';
import type { Port } from './types';

/** The default action id, and what {@link connectBinding} points at. */
export const CONNECT_ACTION_ID = 'diagram.connect';

/** Whether an edge may run from `from` to `to`. */
export type CanConnect = (from: Port, to: Port) => boolean;

/** The edge a finished connect describes. Both ends are resolved ports, so a
 *  consumer minting the node has nothing left to look up. */
export interface PendingEdge {
  from: Port;
  to: Port;
  /** Registry key for the router the new edge should name. */
  router: string;
}

/**
 * The shipped policy: a port may not join itself, and two ports that both
 * declare a `type` must declare the same one.
 *
 * A port with no type joins anything — `PortSpec.type` is uninterpreted by this
 * package, so an untyped diagram stays fully connectable without opting out.
 * Two ports on the *same node* may be joined: a self-edge between two different
 * ports is meaningful in a state machine, and refusing it here would be policy
 * masquerading as a rule.
 */
export const defaultCanConnect: CanConnect = (from, to) => {
  if (from.nodeId === to.nodeId && from.id === to.id) return false;
  if (from.type === undefined || to.type === undefined) return true;
  return from.type === to.type;
};

export interface ConnectActionOptions<TPose> {
  /** Where the droppable ports come from. The same source the port affordance
   *  reads, so what is grabbable and what is landable cannot disagree. */
  participants: ParticipantSource<TPose>;
  /** Default {@link CONNECT_ACTION_ID}. */
  id?: string;
  read?: DiagramNodeReader;
  geometry?: PoseDescriptor<TPose>;
  /** Default {@link defaultCanConnect}. */
  canConnect?: CanConnect;
  /** How near the pointer must come to a port, in world units, before the
   *  edge snaps to it. Default 16. */
  snapRadius?: number;
  /** Registry key the new edge names, and the router the preview draws with.
   *  Default `'straight'`. */
  router?: string;
  routers?: Readonly<Record<string, Router>>;
  /** How the in-flight edge is painted. */
  stroke?: Stroke;
  /**
   * Mints and commits the edge. Called once, on release over a valid port.
   *
   * Defaults to {@link commitEdgeToScene} against `deps.scene`, which is what
   * makes the gesture work with nothing wired. Override it the way a consumer
   * overrides the kit's `insert` dep — to choose the edge node's data, its
   * layer, or its stroke.
   */
  commit?: (edge: PendingEdge, ctx: InvocationCtx) => void;
}

const DEFAULT_SNAP = 16;
/** What a connect-authored edge is drawn with, when the consumer overrides
 *  nothing. */
export const DEFAULT_EDGE_STROKE: Stroke = {
  paint: { color: '#7ba7c7' },
  width: 2,
  markerEnd: 'arrow',
};
const DEFAULT_ROUTER = 'straight';
const PREVIEW_STROKE: Stroke = { paint: { color: '#7ba7c7' }, width: 2, dash: [4, 4] };

interface ConnectScratch {
  from: Port;
  current: Vec2;
  open: boolean;
  /** The deps bag as it was at `start`. The dispatcher builds it once, so
   *  every later pump event carries `deps: {}` — an action that reads a dep at
   *  commit time reads nothing and commits nothing, silently. */
  deps: InvocationCtx['deps'];
}

/**
 * The binding that starts a connect: a drag whose press landed on the port
 * layer's own chrome.
 *
 * The string form of `target` rather than a predicate, because it ranks higher
 * in specificity — a bare `{ kind: 'drag' }` on the select tool cannot outrank
 * it, so no tool needs a predicate of its own to keep out of the way.
 */
export function connectBinding(actionId: string = CONNECT_ACTION_ID): GestureBinding {
  return {
    spec: { kind: 'drag', target: `affordance:${PORT_AFFORDANCE_KIND}` },
    actionId,
  };
}

/** The action id that absorbs a press on a port. */
export const GRAB_PORT_ACTION_ID = 'diagram.grabPort';

/**
 * Absorbs a press on a port, and does nothing else.
 *
 * A port claims the press **protocol**, not one gesture in it: `pointerDown`,
 * `click` and `drag` are a single claimable `'pointer'` token, and an exclusive
 * claim bars every binding whose target does not consult the affordance. So a
 * bundle that binds only `drag` leaves the pointerdown with nowhere to go, and
 * the dispatcher drops the press — the drag it would have grown into never
 * happens. Absorbing the press is also the behavior you want on its own: a
 * press on a port should not pick or deselect the node underneath it.
 */
export function grabPortAction(id: string = GRAB_PORT_ACTION_ID): Action {
  return {
    id,
    label: 'Grab port',
    group: 'diagram',
    invoker: { timing: 'immediate', run: () => {} },
    enabled: () => true as const,
  };
}

/** The two bindings that keep a port's claim from dropping the press. */
export function grabPortBindings(actionId: string = GRAB_PORT_ACTION_ID): GestureBinding[] {
  return [
    { spec: { kind: 'pointerDown', target: `affordance:${PORT_AFFORDANCE_KIND}` }, actionId },
    { spec: { kind: 'click', target: `affordance:${PORT_AFFORDANCE_KIND}` }, actionId },
  ];
}

/**
 * The default commit: one leaf node carrying the edge trait, added to
 * `deps.scene`. One `add` is one history entry, so the edge undoes in one.
 *
 * The edge lands on the **source node's** layer rather than the bottom one: an
 * edge between two nodes on a `wires` layer belongs on `wires`, and picking the
 * first layer in the stack would quietly move it somewhere the author did not
 * put its endpoints.
 */
export function commitEdgeToScene(edge: PendingEdge, ctx: InvocationCtx): void {
  const scene = ctx.deps['scene'] as Scene<unknown, string, unknown> | undefined;
  if (scene === undefined) return;
  const trait: DiagramEdge = {
    from: { port: edge.from.id },
    to: { port: edge.to.id },
    router: edge.router,
  };
  const source = scene.get(edge.from.nodeId as never);
  scene.add({
    kind: 'leaf',
    layer: source?.layer ?? scene.layers[0]!.id,
    pose: { x: 0, y: 0, width: 0, height: 0 } as never,
    // An edge runs *from* one node *to* another, and a plain line does not say
    // so. The arrowhead is an ordinary stroke marker, which is why nothing in
    // this package draws one.
    data: { diagram: trait, stroke: DEFAULT_EDGE_STROKE } as never,
    dependsOn: [edge.from.nodeId as never, edge.to.nodeId as never],
    // Without this the edge re-resolves on every dependency move and paints
    // nothing. `EDGE_DERIVE_PATH` rather than a fresh `edgeDerivePath()` so the
    // scene can find its registry key and the edge survives `toJSON`.
    derivePath: EDGE_DERIVE_PATH as never,
  });
}

/**
 * The `diagram.connect` action: an ongoing drag whose preview is an ephemeral
 * edge and whose commit is one op batch.
 *
 * A factory rather than a singleton because every input it needs — which nodes
 * are droppable, what counts as a legal pair, how an edge node is shaped — is
 * the consumer's, and this package has no scene at module scope. Same reason
 * `edgeDerivePath` and `diagramShape` are factories.
 */
export function createConnectAction<TPose>(opts: ConnectActionOptions<TPose>): Action {
  const {
    id = CONNECT_ACTION_ID,
    canConnect = defaultCanConnect,
    snapRadius = DEFAULT_SNAP,
    router: routerKey = DEFAULT_ROUTER,
    commit = commitEdgeToScene,
    stroke = PREVIEW_STROKE,
  } = opts;
  const routers = opts.routers ?? ROUTERS;
  const portOpts = {
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    ...(opts.read ? { read: opts.read } : {}),
  };
  const route: Router = routers[routerKey] ?? routers['straight'] ?? ROUTERS['straight']!;

  /** The port the pointer is over and may legally land on, or `null`.
   *
   *  `canConnect` is applied here rather than at commit, so an illegal port is
   *  not a candidate at all: the edge does not snap to it and releasing over it
   *  does nothing. */
  function targetPort(from: Port, at: Vec2): Port | null {
    let best: Port | null = null;
    let bestD2 = snapRadius * snapRadius;
    for (const { node, pose } of opts.participants()) {
      for (const port of portsOf(node, pose, portOpts)) {
        if (!canConnect(from, port)) continue;
        const d2 = (port.point.x - at.x) ** 2 + (port.point.y - at.y) ** 2;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = port;
        }
      }
    }
    return best;
  }

  /** The end the edge currently runs to: a snapped port, or the bare pointer.
   *  A free end is a port with no facing, so a router aims straight at it. */
  function endAt(from: Port, at: Vec2): { port: Port | null; end: Port } {
    const port = targetPort(from, at);
    return {
      port,
      end: port ?? { id: '', nodeId: '', point: at, normal: null },
    };
  }

  return {
    id,
    label: 'Connect',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const pressed = portScratchOf(ctx.drag?.affordance);
        // Not a port press. The binding spec already said only port presses
        // reach here, so this is the runtime backstop, not the gate — and an
        // empty handle is how the dispatcher is told to fall through.
        if (pressed === null) return {};
        const scratch: ConnectScratch = {
          from: pressed.port,
          current: { x: ctx.world.x, y: ctx.world.y },
          open: true,
          deps: ctx.deps,
        };

        return {
          kind: 'diagram-connect',
          onMove(moveCtx: InvocationCtx): void {
            scratch.current = { x: moveCtx.world.x, y: moveCtx.world.y };
          },
          overlay(): OngoingOverlay | null {
            if (!scratch.open) return null;
            const { end } = endAt(scratch.from, scratch.current);
            const points = route({ from: scratch.from, to: end, waypoints: [] });
            if (points.length < 2) return null;
            const cmd: DrawCommand = {
              kind: 'path',
              path: polylineFromPoints(points as { x: number; y: number }[]),
              stroke,
            };
            return { kind: 'commands', commands: [cmd], space: 'world' };
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            scratch.open = false;
            if (reason === 'cancel') return;
            const { port } = endAt(scratch.from, { x: endCtx.world.x, y: endCtx.world.y });
            if (port === null) return;
            // World and modifiers from the release; deps from the press.
            commit(
              { from: scratch.from, to: port, router: routerKey },
              { ...endCtx, deps: scratch.deps },
            );
          },
        };
      },
    },
    enabled: () => true as const,
  };
}
