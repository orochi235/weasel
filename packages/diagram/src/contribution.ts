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
import {
  ActionDisabledReason,
  type Action,
  type Contribution,
  type CursorSpec,
  type NodeId,
  type RenderLayer,
  type Scene,
} from '@weasel-js/core';
import {
  CONNECT_ACTION_ID,
  connectBinding,
  createConnectAction,
  grabPortAction,
  grabPortBindings,
  type ConnectActionOptions,
} from './connect';
import { EDIT_EDGE_LABEL_ACTION_ID } from './edgeLabel';
import { createSetHopsAction } from './hops/hopsAction';
import { createResetLabelAction } from './labelCommands';
import { MOVE_LABEL_ACTION_ID, createLabelDragAction, type LabelDragOptions } from './labelDragAction';
import { LABEL_DRAG_AFFORDANCE_KIND, labelDragLayer, labelScratchOf } from './labelDragLayer';
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
 * `diagram.resetRoute` command, the commands that set the selected
 * connectors' router (`SET_ROUTER_ACTION_IDS`), and the line jumps toggle
 * (`SET_HOPS_ACTION_ID`). Like `diagramPorts`, one without the other
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
        ...routerActions({ participants: opts.participants, selected: opts.selected }),
        createSetHopsAction(),
        grabPortAction(GRAB_WAYPOINT_ACTION_ID),
      ],
      bindings: [
        { spec: { kind: 'drag', target }, actionId, opts: { id: 'weasel-diagram-waypoints.drag' } },
        { spec: { kind: 'doubleClick', target }, actionId: REMOVE_WAYPOINT_ACTION_ID, opts: { id: 'weasel-diagram-waypoints.doubleClick' } },
        ...grabPortBindings(GRAB_WAYPOINT_ACTION_ID, WAYPOINT_AFFORDANCE_KIND),
      ],
    },
  };
}

/** The action id that absorbs a press on an edge label, so it reaches neither marquee nor pan. */
export const GRAB_LABEL_ACTION_ID = 'diagram.grabLabel';

/** The action id that selects a clicked label's edge. */
export const SELECT_LABEL_EDGE_ACTION_ID = 'diagram.selectLabelEdge';

const NO_MODIFIERS = { shift: false, meta: false, ctrl: false };
const ANY_MODIFIERS = { shift: 'optional', meta: 'optional', ctrl: 'optional', alt: 'optional' } as const;

function selectLabelEdgeAction(): Action {
  return {
    id: SELECT_LABEL_EDGE_ACTION_ID,
    label: 'Select label edge',
    group: 'diagram',
    requires: ['selection'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const p = params as { affordance?: { payload?: unknown }; mods?: { shift: boolean; meta: boolean; ctrl: boolean } } | undefined;
        const pressed = labelScratchOf(p?.affordance);
        if (pressed !== null) deps.selection?.applyClick(pressed.edgeId as NodeId, p?.mods ?? NO_MODIFIERS);
      },
    },
    enabled: (deps) => (deps?.selection !== undefined ? true : ActionDisabledReason.NotApplicable),
  };
}

/**
 * Both halves of label dragging: the label layer to `registerLayer` — before
 * the port layer, so a port or a route handle wins over a label beside it —
 * and the contribution to pass as `ambient`, which carries the drag
 * (`diagram.moveLabel`), a click that selects the label's edge, and a
 * double-click that edits the label's text through
 * `EDIT_EDGE_LABEL_ACTION_ID`, which the host registers. Like `diagramPorts`,
 * one without the other fails quietly.
 */
export function diagramLabelDrag(
  opts: LabelDragOptions & { scene: Scene<unknown, string, unknown>; selected: () => readonly string[]; cursor?: CursorSpec },
): { layer: RenderLayer<unknown>; contribution: Contribution } {
  const actionId = opts.id ?? MOVE_LABEL_ACTION_ID;
  const target = `affordance:${LABEL_DRAG_AFFORDANCE_KIND}` as const;
  return {
    layer: labelDragLayer(opts.scene, opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
    contribution: {
      id: 'weasel-diagram-label-drag',
      eligibility: { claimed: true },
      actions: [
        createLabelDragAction({ ...opts, id: actionId }),
        createResetLabelAction({ selected: opts.selected, ...(opts.commit ? { commit: opts.commit } : {}) }),
        grabPortAction(GRAB_LABEL_ACTION_ID),
        selectLabelEdgeAction(),
      ],
      bindings: [
        { spec: { kind: 'drag', target }, actionId, opts: { id: 'weasel-diagram-label-drag.drag' } },
        { spec: { kind: 'pointerDown', target }, actionId: GRAB_LABEL_ACTION_ID, opts: { id: 'weasel-diagram-label-drag.pointerDown' } },
        { spec: { kind: 'click', target, mods: ANY_MODIFIERS }, actionId: SELECT_LABEL_EDGE_ACTION_ID, opts: { id: 'weasel-diagram-label-drag.click' } },
        { spec: { kind: 'doubleClick', target }, actionId: EDIT_EDGE_LABEL_ACTION_ID, opts: { id: 'weasel-diagram-label-drag.doubleClick' } },
      ],
    },
  };
}
