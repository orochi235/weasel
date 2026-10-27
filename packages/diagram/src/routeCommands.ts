/**
 * The route edits that are not drags: a double-click on a route handle, and
 * the Reset route command.
 */
import { ActionDisabledReason, type Action, type ActionDeps, type InvocationCtx } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { createEdgeEnds } from './edgeEndLayer';
import { diagramEdgeOf } from './edgeTrait';
import { commitRouteToScene, type RouteEdit, type RouteEditOptions } from './waypointAction';
import { WAYPOINT_HIT_PX, routeStateOf, waypointScratchOf, type EdgeRouteState } from './waypointLayer';
import { avoid } from './edge';
import { removeSegment, removeWaypoint, unpinSegment, type RouteHandle } from './waypoints';
import type { ImmediateParams } from '@weasel-js/core';

/** The action that removes a waypoint, straightens a segment, or unpins an
 *  `avoid` connector's segment, on a double-click of its handle. */
export const REMOVE_WAYPOINT_ACTION_ID = 'diagram.removeWaypoint';
/** The command that clears the selected edges' waypoints. */
export const RESET_ROUTE_ACTION_ID = 'diagram.resetRoute';

const NO_MODIFIERS = { alt: false, shift: false, meta: false, ctrl: false };

/** The waypoints left once `handle` is double-clicked away; null where it removes nothing. */
function removalOf(route: EdgeRouteState, handle: RouteHandle): Vec2[] | null {
  if (handle.kind === 'vertex') return removeWaypoint(route.stops, handle.index);
  if (handle.kind === 'segment') {
    return route.router === avoid ? unpinSegment(route.drawn, route.stops, handle.index) : removeSegment(route.drawn, handle.index);
  }
  return null;
}

/** The `diagram.removeWaypoint` action: a double-click on a waypoint's dot
 *  removes it, and on a segment's bar straightens that jog away. Where it
 *  would remove nothing it declines, so the double-click reaches whatever is
 *  under the handle, an edge's label editing among them. */
export function createRemoveWaypointAction<TPose>(opts: RouteEditOptions<TPose>): Action {
  const { commit = commitRouteToScene, hitRadiusPx = WAYPOINT_HIT_PX } = opts;
  const endsOf = createEdgeEnds(opts.participants, opts);
  const routeOf = (edgeId: string) => {
    const ends = endsOf(edgeId);
    return ends === null ? null : routeStateOf(ends as never, opts.routers);
  };
  /** The removal a double-click at `at` makes, read off the handles as the layer places them. */
  const removalAt = (deps: ActionDeps | undefined, at: Vec2): RouteEdit | null => {
    const reach = hitRadiusPx / Math.abs(deps?.view?.get().scale.x || 1);
    for (const edgeId of opts.selected()) {
      const route = routeOf(edgeId);
      for (const handle of route?.handles ?? []) {
        if (Math.max(Math.abs(handle.at.x - at.x), Math.abs(handle.at.y - at.y)) > reach) continue;
        const waypoints = removalOf(route!, handle);
        if (waypoints !== null) return { edgeId, waypoints };
      }
    }
    return null;
  };
  return {
    id: REMOVE_WAYPOINT_ACTION_ID,
    label: 'Remove waypoint',
    group: 'diagram',
    requires: ['scene', 'view'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const p = params as ImmediateParams | undefined;
        const world = p?.world;
        if (!world) return;
        const pressed = waypointScratchOf(p.affordance as { payload?: unknown } | undefined);
        const route = pressed === null ? null : routeOf(pressed.edgeId);
        const waypoints = pressed === null || route === null ? null : removalOf(route, pressed.handle);
        const edit = pressed !== null && waypoints !== null ? { edgeId: pressed.edgeId, waypoints } : removalAt(deps, world);
        if (edit !== null) commit(edit, { world, modifiers: NO_MODIFIERS, deps } as InvocationCtx);
      },
    },
    enabled: (deps, at) => (at !== undefined && removalAt(deps, at) !== null ? true : ActionDisabledReason.NotApplicable),
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
        const ctx = { world: { x: 0, y: 0 }, modifiers: NO_MODIFIERS, deps } as InvocationCtx;
        const all = () => { for (const edgeId of edges) commit({ edgeId, waypoints: [] }, ctx); };
        if (deps.scene === undefined) all();
        else deps.scene.batch('Reset route', all);
      },
    },
    enabled: () => (routedEdges(opts).length > 0 ? true : ActionDisabledReason.NotApplicable),
  };
}
