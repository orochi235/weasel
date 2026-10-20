/**
 * The plugin as a `Contribution` bundle — one object a consumer hands to
 * `<SceneCanvas ambient={…}>`.
 *
 * **Ambient, not a tool.** A port is grabbable whatever tool is active:
 * `claimed` makes the bundle live for a press the port layer's affordance
 * claimed, and dormant otherwise.
 *
 * **The layer is not in here, on purpose.** `Contribution.overlay` is painted
 * and never hit-tested — only `CanvasExtensionApi.registerLayer` gets a
 * `hitTest` call — so the port layer as an overlay would paint every port and
 * make none of them grabbable. {@link diagramPorts} hands back both.
 */
import type { Contribution, RenderLayer } from '@weasel-js/core';
import {
  CONNECT_ACTION_ID,
  connectBinding,
  createConnectAction,
  grabPortAction,
  grabPortBindings,
  type ConnectActionOptions,
} from './connect';
import { portLayer } from './portLayer';
import type { PortAffordanceOptions } from './portAffordance';
import { REMOVE_WAYPOINT_ACTION_ID, createRemoveWaypointAction, createResetRouteAction } from './routeCommands';
import { routerActions } from './routerCommands';
import { ROUTE_EDIT_ACTION_ID, createRouteEditAction, type RouteEditOptions } from './waypointAction';
import {
  WAYPOINT_AFFORDANCE_KIND,
  WAYPOINT_LAYER_ID,
  waypointLayer,
  type WaypointAffordanceOptions,
} from './waypointLayer';

export { CONNECT_ACTION_ID };

/** The connect action's options and the port affordance's, in one bag. */
export interface DiagramContributionOptions<TPose>
  extends ConnectActionOptions<TPose>, PortAffordanceOptions<TPose> {}

/** The bundle: the connect action and the one binding that reaches it. */
export function createDiagramContribution<TPose>(
  opts: DiagramContributionOptions<TPose>,
): Contribution {
  const actionId = opts.id ?? CONNECT_ACTION_ID;
  return {
    id: 'weasel-diagram',
    eligibility: { claimed: true },
    actions: [createConnectAction({ ...opts, id: actionId }), grabPortAction()],
    bindings: [connectBinding(actionId), ...grabPortBindings()],
  };
}

/**
 * Both halves of the port affordance: the layer to `registerLayer`, and the
 * contribution to pass as `ambient`.
 *
 * They are returned together because attaching one without the other fails
 * quietly — the layer alone paints ports that start no gesture, and the
 * contribution alone binds an affordance kind nothing ever reports.
 */
export function diagramPorts<TPose>(opts: DiagramContributionOptions<TPose>): {
  layer: RenderLayer<unknown>;
  contribution: Contribution;
} {
  return {
    layer: portLayer(opts.participants, opts),
    contribution: createDiagramContribution(opts),
  };
}

/** The action id that absorbs the rest of a press on a route handle. */
export const GRAB_WAYPOINT_ACTION_ID = 'diagram.grabWaypoint';

/**
 * Both halves of route editing: the handle layer to `registerLayer` — after
 * the port layer and before the edge-end layer, so an end handle wins over a
 * route handle beside it — and the contribution to pass as `ambient`, which
 * carries the drag, the double-click that removes, the
 * `diagram.resetRoute` command, and the commands that set the selected
 * connectors' router (`SET_ROUTER_ACTION_IDS`). Like `diagramPorts`, one without the other
 * fails quietly.
 */
export function diagramWaypoints<TPose>(
  opts: RouteEditOptions<TPose> & Omit<WaypointAffordanceOptions<TPose>, 'id'>,
): { layer: RenderLayer<unknown>; contribution: Contribution } {
  const actionId = opts.id ?? ROUTE_EDIT_ACTION_ID;
  const target = `affordance:${WAYPOINT_AFFORDANCE_KIND}` as const;
  return {
    // `opts.id` names the drag action; the layer keeps its own id.
    layer: waypointLayer(opts.participants, opts.selected, { ...opts, id: WAYPOINT_LAYER_ID }),
    contribution: {
      id: 'weasel-diagram-waypoints',
      eligibility: { claimed: true },
      actions: [
        createRouteEditAction({ ...opts, id: actionId }),
        createRemoveWaypointAction(opts),
        createResetRouteAction(opts),
        ...routerActions(opts),
        grabPortAction(GRAB_WAYPOINT_ACTION_ID),
      ],
      bindings: [
        { spec: { kind: 'drag', target }, actionId },
        { spec: { kind: 'doubleClick', target }, actionId: REMOVE_WAYPOINT_ACTION_ID },
        ...grabPortBindings(GRAB_WAYPOINT_ACTION_ID, WAYPOINT_AFFORDANCE_KIND),
      ],
    },
  };
}
