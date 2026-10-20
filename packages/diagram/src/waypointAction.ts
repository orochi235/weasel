/**
 * Route editing — dragging a selected edge's waypoints and segments, and
 * double-clicking one away.
 *
 * The route handles (`waypointLayer`) claim the press; these actions reshape
 * the route. The drag previews the edge's own data with the new waypoints,
 * so its `derivePath` draws the preview exactly as the commit will.
 */
import { ActionDisabledReason, type Action, type InvocationCtx, type OngoingHandle, type OngoingOverlay } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { createEdgeEnds, type EdgeEndOptions } from './edgeEndLayer';
import { diagramEdgeOf, samePoints, type DiagramEdge } from './edgeTrait';
import type { ParticipantSource } from './portAffordance';
import { portTarget, snapPoint, stopTarget } from './routeSnap';
import { routeStateOf, waypointScratchOf, type EdgeRouteState } from './waypointLayer';
import {
  dragSegment, dragVertex, insertWaypoint, removeSegment, removeWaypoint, type RouteHandle,
} from './waypoints';

/** The action that drags a route handle. */
export const ROUTE_EDIT_ACTION_ID = 'diagram.editRoute';
/** The action that removes a waypoint, or straightens a segment, on a double-click of its handle. */
export const REMOVE_WAYPOINT_ACTION_ID = 'diagram.removeWaypoint';
/** The command that clears the selected edges' waypoints. */
export const RESET_ROUTE_ACTION_ID = 'diagram.resetRoute';

/** An edge's route edited: its waypoints as they now stand. */
export interface RouteEdit {
  edgeId: string;
  waypoints: readonly Vec2[];
}

/** Options for {@link createRouteEditAction} and {@link createRemoveWaypointAction}. */
export interface RouteEditOptions<TPose> extends EdgeEndOptions<TPose> {
  participants: ParticipantSource<TPose>;
  /** The selected edge ids, whose routes show handles. */
  selected: () => readonly string[];
  /** Screen pixels within which a dragged handle lines up with a neighbor. Default 6. */
  snapPx?: number;
  /** Defaults to {@link commitRouteToScene} against `deps.scene`. */
  commit?: (edit: RouteEdit, ctx: InvocationCtx) => void;
  id?: string;
}

const DEFAULT_SNAP_PX = 6;

/** `data` with its edge trait routed through `waypoints`: owned by the author
 *  from now on, so layout's mark is dropped, and no waypoints at all when there are none. */
export function routedData(data: unknown, trait: DiagramEdge, waypoints: readonly Vec2[]): Record<string, unknown> {
  const { waypoints: _w, laidOut: _l, ...rest } = trait;
  return { ...(data as Record<string, unknown>), diagram: waypoints.length > 0 ? { ...rest, waypoints } : rest };
}

/** The default commit: the edge's new waypoints in `data.diagram`, as one history entry labeled "Edit route". */
export function commitRouteToScene(edit: RouteEdit, ctx: InvocationCtx): void {
  const scene = ctx.deps.scene;
  const node = scene?.get(edit.edgeId as never);
  const trait = node === undefined ? null : diagramEdgeOf(node);
  if (scene === undefined || node === undefined || trait === null) return;
  scene.batch('Edit route', () => {
    scene.update(node.id, { data: routedData(node.data, trait, edit.waypoints) as never });
  });
}

/** What a route drag captured at its press, read-only after. */
interface RoutePress {
  edgeId: string;
  handle: RouteHandle;
  route: EdgeRouteState;
  trait: DiagramEdge;
  data: unknown;
  pose: unknown;
  press: Vec2;
  tolerance: number;
  deps: InvocationCtx['deps'];
}

/** What one frame of a route drag proposes: the new waypoints, and the guides
 *  its snaps drew. Null waypoints propose nothing. */
interface RouteFrame {
  waypoints: readonly Vec2[] | null;
  guides: readonly (readonly [Vec2, Vec2])[];
}

const NONE: RouteFrame = { waypoints: null, guides: [] };

/** The frame of `p` with the pointer at `current`. */
function frameAt(p: RoutePress, current: Vec2): RouteFrame {
  const d = { x: current.x - p.press.x, y: current.y - p.press.y };
  if (d.x === 0 && d.y === 0) return NONE;
  const { handle, route } = p;
  const { stops, drawn } = route;
  let next: Vec2[];
  let guides: (readonly [Vec2, Vec2])[];
  if (handle.kind === 'segment') {
    const across = handle.axis === 'x' ? 'y' : 'x';
    const others = drawn.filter((_, i) => i !== handle.index && i !== handle.index + 1).map(stopTarget);
    const mid = { x: handle.at.x + (across === 'x' ? d.x : 0), y: handle.at.y + (across === 'y' ? d.y : 0) };
    const snapped = snapPoint(mid, others, p.tolerance, { x: across === 'x', y: across === 'y' });
    next = dragSegment(drawn, handle.index, snapped.point[across] - handle.at[across]);
    guides = snapped.guides;
  } else {
    const at = handle.kind === 'vertex' ? handle.index + 1 : handle.leg + 1;
    const neighbors = [stops[at - 1]!, stops[handle.kind === 'vertex' ? at + 1 : at]!];
    const ends = [portTarget(p.route.from), portTarget(p.route.to)];
    const snapped = snapPoint({ x: handle.at.x + d.x, y: handle.at.y + d.y }, [...neighbors.map(stopTarget), ...ends], p.tolerance);
    next = handle.kind === 'vertex' ? dragVertex(stops, handle.index, snapped.point) : insertWaypoint(stops, handle.leg, snapped.point);
    guides = snapped.guides;
  }
  return samePoints(next, p.trait.waypoints ?? []) ? { waypoints: null, guides } : { waypoints: next, guides };
}

/** The `diagram.editRoute` action: an ongoing drag reshaping one edge's route. */
export function createRouteEditAction<TPose>(opts: RouteEditOptions<TPose>): Action {
  const { commit = commitRouteToScene, snapPx = DEFAULT_SNAP_PX } = opts;
  const endsOf = createEdgeEnds(opts.participants, opts);
  return {
    id: opts.id ?? ROUTE_EDIT_ACTION_ID,
    label: 'Edit route',
    group: 'diagram',
    requires: ['scene', 'view'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const pressed = waypointScratchOf(ctx.drag?.affordance);
        const ends = pressed === null ? null : endsOf(pressed.edgeId);
        if (pressed === null || ends === null) return {};
        const p: RoutePress = {
          edgeId: pressed.edgeId,
          handle: pressed.handle,
          route: routeStateOf(ends as never, opts.routers),
          trait: ends.trait,
          data: ends.edge.node.data,
          pose: ends.edge.pose,
          press: ctx.drag?.start ?? { x: ctx.world.x, y: ctx.world.y },
          tolerance: snapPx / Math.abs(ctx.deps.view?.get().scale.x || 1),
          deps: ctx.deps,
        };
        let frame = NONE;
        let open = true;
        const proposed = () => (open ? frame.waypoints : null);
        return {
          kind: 'diagram-edit-route',
          onMove(moveCtx: InvocationCtx): void {
            frame = frameAt(p, moveCtx.world);
          },
          previewIds: () => (proposed() === null ? null : [p.edgeId]),
          previewPose: (id) => (id === p.edgeId && proposed() !== null ? p.pose : null),
          previewData: (id) => {
            const waypoints = proposed();
            return id === p.edgeId && waypoints !== null ? routedData(p.data, p.trait, waypoints) : null;
          },
          overlay(): OngoingOverlay[] | null {
            return open ? frame.guides.map((g) => ({ kind: 'polyline', points: [g[0], g[1]], role: 'guide' })) : null;
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            if (reason === 'cancel') return;
            const waypoints = frameAt(p, endCtx.world).waypoints;
            if (waypoints !== null) commit({ edgeId: p.edgeId, waypoints }, { ...endCtx, deps: p.deps });
          },
        };
      },
    },
    enabled: () => true as const,
  };
}

/** The selected edges that have waypoints of their own. */
function routedEdges<TPose>(opts: RouteEditOptions<TPose>): string[] {
  const ids = new Set(opts.selected());
  if (ids.size === 0) return [];
  const out: string[] = [];
  for (const { node } of opts.participants()) {
    if (ids.has(node.id) && (diagramEdgeOf(node)?.waypoints ?? []).length > 0) out.push(node.id);
  }
  return out;
}

/** The `diagram.resetRoute` command: clears the selected edges' waypoints,
 *  in one history entry when they commit to the scene. */
export function createResetRouteAction<TPose>(opts: RouteEditOptions<TPose>): Action {
  const { commit = commitRouteToScene } = opts;
  return {
    id: RESET_ROUTE_ACTION_ID,
    label: 'Reset route',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps) {
        const edges = routedEdges(opts);
        const ctx = { world: { x: 0, y: 0 }, modifiers: { alt: false, shift: false, meta: false, ctrl: false }, deps } as InvocationCtx;
        const all = () => { for (const edgeId of edges) commit({ edgeId, waypoints: [] }, ctx); };
        if (deps.scene === undefined) all();
        else deps.scene.batch('Reset route', all);
      },
    },
    enabled: () => (routedEdges(opts).length > 0 ? true : ActionDisabledReason.NotApplicable),
  };
}

/** The `diagram.removeWaypoint` action: a double-click on a waypoint's dot
 *  removes it, and on a segment's bar straightens that jog away. */
export function createRemoveWaypointAction<TPose>(opts: RouteEditOptions<TPose>): Action {
  const { commit = commitRouteToScene } = opts;
  const endsOf = createEdgeEnds(opts.participants, opts);
  return {
    id: REMOVE_WAYPOINT_ACTION_ID,
    label: 'Remove waypoint',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const pressed = waypointScratchOf((params as { affordance?: { payload?: unknown } } | undefined)?.affordance);
        const ends = pressed === null ? null : endsOf(pressed.edgeId);
        if (pressed === null || ends === null) return;
        const { stops, drawn } = routeStateOf(ends as never, opts.routers);
        const { handle } = pressed;
        const waypoints = handle.kind === 'vertex' ? removeWaypoint(stops, handle.index)
          : handle.kind === 'segment' ? removeSegment(drawn, handle.index)
            : null;
        if (waypoints === null) return;
        const world = { x: Number(params?.worldX), y: Number(params?.worldY) };
        const ctx = { world, modifiers: { alt: false, shift: false, meta: false, ctrl: false }, deps } as InvocationCtx;
        commit({ edgeId: pressed.edgeId, waypoints }, ctx);
      },
    },
    enabled: () => true as const,
  };
}
