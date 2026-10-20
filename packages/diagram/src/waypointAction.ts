/**
 * Route editing — dragging a selected edge's waypoints and segments.
 *
 * The route handles (`waypointLayer`) claim the press; this action reshapes
 * the route. The drag previews the edge's own data with the new waypoints,
 * so its `derivePath` draws the preview exactly as the commit will.
 */
import type { Action, InvocationCtx, OngoingHandle, OngoingOverlay } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { createEdgeEnds, type EdgeEndOptions } from './edgeEndLayer';
import { diagramEdgeOf, samePoints, type DiagramEdge } from './edgeTrait';
import type { ParticipantSource } from './portAffordance';
import { portTarget, snapPoint, stopTarget } from './routeSnap';
import { routeStateOf, waypointScratchOf, type EdgeRouteState } from './waypointLayer';
import { dragSegment, dragVertex, insertWaypoint, type RouteHandle } from './waypoints';

/** The action that drags a route handle. */
export const ROUTE_EDIT_ACTION_ID = 'diagram.editRoute';

/** An edge's route edited: its waypoints as they now stand. */
export interface RouteEdit {
  edgeId: string;
  waypoints: readonly Vec2[];
}

/** Options for the route-editing actions: the drag, the double-click that removes, and Reset route. */
export interface RouteEditOptions<TPose> extends EdgeEndOptions<TPose> {
  participants: ParticipantSource<TPose>;
  /** The selected edge ids, whose routes show handles. */
  selected: () => readonly string[];
  /** Screen pixels within which a dragged handle lines up with a neighbor. Default 6. */
  snapPx?: number;
  /** Screen-pixel reach of a handle, as the handle layer's `hitRadiusPx`. Default 7. */
  hitRadiusPx?: number;
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
