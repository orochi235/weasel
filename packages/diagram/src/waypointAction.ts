/**
 * Route editing — dragging a selected edge's waypoints and segments.
 *
 * The route handles (`waypointLayer`) claim the press; this action reshapes
 * the route. The drag previews the edge's own data with the new waypoints,
 * so its `derivePath` draws the preview exactly as the commit will.
 */
import { SNAP_ROLES, snapMods, type Action, type InvocationCtx, type OngoingHandle, type SnapSession } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { createEdgeEnds, type EdgeEndOptions } from './edgeEndLayer';
import { diagramEdgeOf, samePoints, type DiagramEdge } from './edgeTrait';
import type { ParticipantSource } from './portAffordance';
import { routeSnapSource } from './routeSnapSource';
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
  /** Screen pixels within which a dragged handle lines up with a neighbor
   *  or a port's axis. Default 6. */
  snapPx?: number;
  /** Screen-pixel reach of a handle, as the handle layer's `hitRadiusPx`. Default 7. */
  hitRadiusPx?: number;
  /** Defaults to {@link commitRouteToScene} against `deps.scene`. */
  commit?: (edit: RouteEdit, ctx: InvocationCtx) => void;
  id?: string;
}

const DEFAULT_SNAP_PX = 6;

/** The id of the snap source each route drag brings. */
const ROUTE_SNAP_ID = 'diagram-route';

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
  deps: InvocationCtx['deps'];
}

/** The snap session for dragging `handle`, whose point is its probe: a
 *  segment held to the axis it slides across, a bend free to turn. */
function beginSnap(ctx: InvocationCtx, p: RoutePress, reachPx: number): SnapSession | null {
  const { handle, route } = p;
  const segment = handle.kind === 'segment';
  const stops = segment
    ? route.drawn.filter((_, i) => i !== handle.index && i !== handle.index + 1)
    : neighborsOf(handle, route.stops);
  const source = routeSnapSource({ id: ROUTE_SNAP_ID, stops, ports: segment ? [] : [route.from, route.to], reachPx });
  return ctx.deps.snap?.begin({
    gesture: 'point',
    press: handle.at,
    ids: [p.edgeId],
    omit: ['path-snap'],
    sources: [source],
    ...(segment ? { handle: handle.axis === 'x' ? { x: 'free', y: 'min' } : { x: 'min', y: 'free' } } : { constrain: 'axis' }),
  }) ?? null;
}

/** The stops either side of a dragged bend or of the leg a bend is inserted in. */
function neighborsOf(handle: Exclude<RouteHandle, { kind: 'segment' }>, stops: readonly Vec2[]): Vec2[] {
  const at = handle.kind === 'vertex' ? handle.index + 1 : handle.leg + 1;
  return [stops[at - 1]!, stops[handle.kind === 'vertex' ? at + 1 : at]!];
}

/** How far the handle moves with the pointer at `ctx.world`, snapped through `session`. */
function moveOf(p: RoutePress, session: SnapSession | null, ctx: InvocationCtx): Vec2 {
  const d = { x: ctx.world.x - p.press.x, y: ctx.world.y - p.press.y };
  if (session === null) return d;
  const at = session.at({ x: p.handle.at.x + d.x, y: p.handle.at.y + d.y }, snapMods(ctx)).point;
  return { x: at.x - p.handle.at.x, y: at.y - p.handle.at.y };
}

/** The waypoints the handle proposes moved by `d`, or null for none. A
 *  segment reads only the axis it slides across. */
function waypointsAt(p: RoutePress, d: Vec2): readonly Vec2[] | null {
  if (d.x === 0 && d.y === 0) return null;
  const { handle, route } = p;
  let next: Vec2[];
  if (handle.kind === 'segment') {
    const across = handle.axis === 'x' ? 'y' : 'x';
    next = dragSegment(route.drawn, handle.index, d[across]);
  } else {
    const point = { x: handle.at.x + d.x, y: handle.at.y + d.y };
    next = handle.kind === 'vertex' ? dragVertex(route.stops, handle.index, point) : insertWaypoint(route.stops, handle.leg, point);
  }
  return samePoints(next, p.trait.waypoints ?? []) ? null : next;
}

/** The `diagram.editRoute` action: an ongoing drag reshaping one edge's route. */
export function createRouteEditAction<TPose>(opts: RouteEditOptions<TPose>): Action {
  const { commit = commitRouteToScene, snapPx = DEFAULT_SNAP_PX } = opts;
  const endsOf = createEdgeEnds(opts.participants, opts);
  return {
    id: opts.id ?? ROUTE_EDIT_ACTION_ID,
    label: 'Edit route',
    group: 'diagram',
    requires: ['scene', 'view', 'snap'],
    modifierRoles: SNAP_ROLES,
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
          deps: ctx.deps,
        };
        const session = beginSnap(ctx, p, snapPx);
        let waypoints: readonly Vec2[] | null = null;
        let open = true;
        const proposed = () => (open ? waypoints : null);
        return {
          kind: 'diagram-edit-route',
          onMove(moveCtx: InvocationCtx): void {
            waypoints = waypointsAt(p, moveOf(p, session, moveCtx));
          },
          previewIds: () => (proposed() === null ? null : [p.edgeId]),
          previewPose: (id) => (id === p.edgeId && proposed() !== null ? p.pose : null),
          previewData: (id) => {
            const next = proposed();
            return id === p.edgeId && next !== null ? routedData(p.data, p.trait, next) : null;
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            const final = reason === 'commit' ? waypointsAt(p, moveOf(p, session, endCtx)) : null;
            session?.end();
            if (final !== null) commit({ edgeId: p.edgeId, waypoints: final }, { ...endCtx, deps: p.deps });
          },
        };
      },
    },
    enabled: () => true as const,
  };
}
