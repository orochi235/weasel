/**
 * Handles along a selected edge's route — what makes its waypoints and
 * segments grabbable, so a drag can reshape the route (`waypointAction`).
 *
 * Built the way the edge-end handles are: point regions with a `null`
 * `targetId` and no `hitKind`, composed into a layer whose id is the kind a
 * press reports.
 */
import {
  composeAffordanceLayer,
  ellipsePath,
  viewToTransform,
  type Affordance,
  type AffordanceRegion,
  type ChromeState,
  type CommandFill,
  type CommandStroke,
  type CursorSpec,
  type RenderLayer,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { routerOf, type Router } from './edge';
import { createEdgeEnds, type EdgeEndOptions, type EdgeEnds } from './edgeEndLayer';
import { offersPorts, type ParticipantSource } from './portAffordance';
import type { Port } from './types';
import { routeHandles, type RouteHandle } from './waypoints';

/** The layer id the route handles are composed into. */
export const WAYPOINT_LAYER_ID = 'diagram-waypoints';

/** The affordance kind a press on a route handle reports. */
export const WAYPOINT_AFFORDANCE_KIND = `layer:${WAYPOINT_LAYER_ID}` as const;

/** What a press on a route handle hands the route-edit actions, as the hit's `payload`. */
export interface WaypointScratch {
  targetId: string;
  edgeId: string;
  handle: RouteHandle;
}

/** Read a route-handle press's scratch back off the hit an action was handed. */
export function waypointScratchOf(hit: { payload?: unknown } | null | undefined): WaypointScratch | null {
  const payload = hit?.payload as WaypointScratch | undefined;
  return payload !== undefined && typeof payload.edgeId === 'string' && typeof payload.handle?.kind === 'string'
    ? payload : null;
}

/** An edge's route as the handles read it: its resolved ends, its stops, the
 *  route drawn through them, the router that drew it, and the handles it shows. */
export interface EdgeRouteState {
  from: Port;
  to: Port;
  stops: readonly Vec2[];
  drawn: readonly Vec2[];
  router: Router;
  handles: readonly RouteHandle[];
}

/** The route state of an edge whose ends `ends` resolved. */
export function routeStateOf(ends: EdgeEnds<unknown>, routers?: Readonly<Record<string, Router>>): EdgeRouteState {
  const { route } = ends;
  const stops = [route.from.point, ...route.waypoints, route.to.point];
  const router = routerOf(ends.trait, routers);
  const handles = route.stubs !== undefined ? [] : routeHandles(route.points, stops, router);
  return { from: route.from, to: route.to, stops, drawn: route.points, router, handles };
}

/** Options for {@link createWaypointAffordance}. */
export interface WaypointAffordanceOptions<TPose> extends EdgeEndOptions<TPose> {
  /** Also the chrome-caps visibility id. Default {@link WAYPOINT_LAYER_ID}. */
  id?: string;
  /** Screen-pixel hit radius. Default 7. */
  hitRadiusPx?: number;
  /** Screen-pixel diameter of a waypoint's dot; an insert dot is three
   *  quarters of it, and a segment bar twice as long. Default 8; 0 paints nothing. */
  sizePx?: number;
  fill?: CommandFill;
  stroke?: CommandStroke;
  cursor?: CursorSpec;
}

/** A route handle's default screen-pixel hit radius. */
export const WAYPOINT_HIT_PX = 7;
const DEFAULT_SIZE_PX = 8;
const DEFAULT_FILL: CommandFill = { paint: { kind: 'solid', color: '#ffffff' } };
const DEFAULT_STROKE: CommandStroke = { paint: { kind: 'solid', color: '#3b6fd4' }, width: 1.5 };

/** A handle's mark, drawn in screen pixels so it keeps its size at any zoom. */
function paintOf(handle: RouteHandle, sizePx: number, fill: CommandFill, stroke: CommandStroke): AffordanceRegion['paint'] {
  return {
    kind: 'custom',
    draw: ({ world, view }) => {
      const t = viewToTransform(view);
      const cx = t.panX + world.x * t.zoom.x;
      const cy = t.panY + world.y * t.zoom.y;
      if (handle.kind === 'segment') {
        const [w, h] = handle.axis === 'x' ? [sizePx * 2, sizePx / 2] : [sizePx / 2, sizePx * 2];
        return [{ kind: 'path', path: { kind: 'rect', x: cx - w / 2, y: cy - h / 2, width: w, height: h }, fill, stroke }];
      }
      const d = handle.kind === 'vertex' ? sizePx : sizePx * 0.75;
      const path = ellipsePath({ x: cx - d / 2, y: cy - d / 2, width: d, height: d });
      return [handle.kind === 'vertex' ? { kind: 'path', path, fill, stroke } : { kind: 'path', path, stroke }];
    },
  };
}

/** The affordance: a region on each route handle of each selected edge. */
export function createWaypointAffordance<TPose>(
  participants: ParticipantSource<TPose>,
  selected: () => readonly string[],
  opts: WaypointAffordanceOptions<TPose> = {},
): Affordance {
  const { id = WAYPOINT_LAYER_ID, hitRadiusPx = WAYPOINT_HIT_PX, sizePx = DEFAULT_SIZE_PX } = opts;
  const endsOf = createEdgeEnds(participants, opts);
  const fill = opts.fill ?? DEFAULT_FILL;
  const stroke = opts.stroke ?? DEFAULT_STROKE;

  return {
    id,
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const out: AffordanceRegion[] = [];
      for (const edgeId of selected()) {
        const ends = endsOf(edgeId);
        if (ends === null || !offersPorts(ends.edge, state)) continue;
        for (const handle of routeStateOf(ends as EdgeEnds<unknown>, opts.routers).handles) {
          out.push({
            id: `${edgeId}:${handle.kind}:${handle.kind === 'insert' ? handle.leg : handle.index}`,
            targetId: null,
            shape: { kind: 'point', x: handle.at.x, y: handle.at.y, hitRadiusPx },
            ...(sizePx > 0 ? { paint: paintOf(handle, sizePx, fill, stroke) } : {}),
            ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
            strength: 'exclusive',
            claimedKinds: ['pointer'],
            bind: () => ({ initialScratch: { targetId: edgeId, edgeId, handle } satisfies WaypointScratch }),
          });
        }
      }
      return out;
    },
  };
}

/** The composed layer, for `CanvasExtensionApi.registerLayer`. Register it
 *  after the port layer and before the edge-end layer: the last registered is
 *  hit first, and an edge's end handle must win over a handle beside it. */
export function waypointLayer<TPose>(
  participants: ParticipantSource<TPose>,
  selected: () => readonly string[],
  opts: WaypointAffordanceOptions<TPose> = {},
): RenderLayer<unknown> {
  return composeAffordanceLayer(
    opts.id ?? WAYPOINT_LAYER_ID,
    'Diagram waypoints',
    [createWaypointAffordance(participants, selected, opts)],
  ) as unknown as RenderLayer<unknown>;
}
