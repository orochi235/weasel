/**
 * The plugin's editing gestures, each as one `SurfaceContribution` a consumer
 * hands to `<SceneCanvas ambient={…}>`.
 *
 * **Ambient, not a tool.** A port is grabbable whatever tool is active:
 * `claimed` makes an entry live for a press its own layer's affordance
 * claimed, and dormant otherwise.
 *
 * **The affordance layer is in `layers`, not `overlay`.** An overlay is
 * painted and never hit-tested, so a port layer there would paint every port
 * and make none of them grabbable.
 */
import {
  ANY_MODS,
  ActionDisabledReason,
  roleMods,
  SNAP_ROLES,
  type Action,
  type CursorSpec,
  type NodeId,
  type Scene,
  type SurfaceContribution,
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

/**
 * Connecting by dragging one port onto another, as one entry to pass as
 * `ambient`: the port layer, the connect action, and the bindings that reach
 * it from a press on a port.
 */
export function diagramPorts<TPose>(opts: DiagramContributionOptions<TPose>): SurfaceContribution {
  const actionId = opts.id ?? CONNECT_ACTION_ID;
  return {
    id: 'weasel-diagram',
    eligibility: { claimed: true },
    layers: [portLayer(opts.participants, opts)],
    actions: [createConnectAction({ ...opts, id: actionId }), grabPortAction()],
    bindings: [connectBinding(actionId), ...grabPortBindings()],
  };
}

/** The action id that absorbs the rest of a press on a route handle. */
export const GRAB_WAYPOINT_ACTION_ID = 'diagram.grabWaypoint';

/**
 * Route editing, as one entry to pass as `ambient` — after `diagramPorts` and
 * before `diagramEdgeEnds`, so an end handle wins over a route handle beside
 * it. It carries the handle layer, the drag, the double-click that removes, the
 * `diagram.resetRoute` command, the commands that set the selected
 * connectors' router (`SET_ROUTER_ACTION_IDS`), and the line jumps toggle
 * (`SET_HOPS_ACTION_ID`).
 */
export function diagramWaypoints<TPose>(
  opts: RouteEditOptions<TPose> & Omit<WaypointAffordanceOptions<TPose>, 'id'>,
): SurfaceContribution {
  const actionId = opts.id ?? ROUTE_EDIT_ACTION_ID;
  const target = `affordance:${WAYPOINT_AFFORDANCE_KIND}` as const;
  return {
    id: 'weasel-diagram-waypoints',
    eligibility: { claimed: true },
    // `opts.id` names the drag action; the layer keeps its own id.
    layers: [waypointLayer(opts.participants, opts.selected, { ...opts, id: WAYPOINT_LAYER_ID })],
    actions: [
      createRouteEditAction({ ...opts, id: actionId }),
      createRemoveWaypointAction(opts),
      createResetRouteAction(opts),
      ...routerActions({ participants: opts.participants, selected: opts.selected }),
      createSetHopsAction(),
      grabPortAction(GRAB_WAYPOINT_ACTION_ID),
    ],
    bindings: [
      { spec: { kind: 'drag', target, mods: roleMods(SNAP_ROLES) }, actionId, opts: { id: 'weasel-diagram-waypoints.drag' } },
      { spec: { kind: 'doubleClick', target }, actionId: REMOVE_WAYPOINT_ACTION_ID, opts: { id: 'weasel-diagram-waypoints.doubleClick' } },
      ...grabPortBindings(GRAB_WAYPOINT_ACTION_ID, WAYPOINT_AFFORDANCE_KIND),
    ],
  };
}

/** The action id that absorbs a press on an edge label, so it reaches neither marquee nor pan. */
export const GRAB_LABEL_ACTION_ID = 'diagram.grabLabel';

/** The action id that selects a clicked label's edge. */
export const SELECT_LABEL_EDGE_ACTION_ID = 'diagram.selectLabelEdge';

const NO_MODIFIERS = { shift: false, meta: false, ctrl: false };

function selectLabelEdgeAction(): Action {
  return {
    id: SELECT_LABEL_EDGE_ACTION_ID,
    label: 'Select label edge',
    group: 'diagram',
    requires: ['selection', 'enteredGroup', 'selectRange'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const p = params as { affordance?: { payload?: unknown }; mods?: { shift: boolean; meta: boolean; ctrl: boolean } } | undefined;
        const pressed = labelScratchOf(p?.affordance);
        if (pressed === null || !deps.selection) return;
        // A range runs the way the select tool's does, over the canvas's own rule.
        const between = deps.selectRange?.at(deps.enteredGroup?.get() ?? null);
        const mods = p?.mods ?? NO_MODIFIERS;
        if (between) deps.selection.applyClick(pressed.edgeId as NodeId, mods, between);
        else deps.selection.applyClick(pressed.edgeId as NodeId, mods);
      },
    },
    enabled: (deps) => (deps?.selection !== undefined ? true : ActionDisabledReason.NotApplicable),
  };
}

/**
 * Label dragging, as one entry to pass as `ambient` — before `diagramPorts`,
 * so a port or a route handle wins over a label beside it. It carries the
 * label layer, the drag (`diagram.moveLabel`), a click that selects the
 * label's edge, and a double-click that edits the label's text through
 * `EDIT_EDGE_LABEL_ACTION_ID`, which the host registers.
 */
export function diagramLabelDrag(
  opts: LabelDragOptions & { scene: Scene<unknown, string, unknown>; selected: () => readonly string[]; cursor?: CursorSpec },
): SurfaceContribution {
  const actionId = opts.id ?? MOVE_LABEL_ACTION_ID;
  const target = `affordance:${LABEL_DRAG_AFFORDANCE_KIND}` as const;
  return {
    id: 'weasel-diagram-label-drag',
    eligibility: { claimed: true },
    layers: [labelDragLayer(opts.scene, opts.cursor !== undefined ? { cursor: opts.cursor } : {})],
    actions: [
      createLabelDragAction({ ...opts, id: actionId }),
      createResetLabelAction({ selected: opts.selected, ...(opts.commit ? { commit: opts.commit } : {}) }),
      grabPortAction(GRAB_LABEL_ACTION_ID),
      selectLabelEdgeAction(),
    ],
    bindings: [
      { spec: { kind: 'drag', target }, actionId, opts: { id: 'weasel-diagram-label-drag.drag' } },
      { spec: { kind: 'pointerDown', target }, actionId: GRAB_LABEL_ACTION_ID, opts: { id: 'weasel-diagram-label-drag.pointerDown' } },
      { spec: { kind: 'click', target, mods: ANY_MODS }, actionId: SELECT_LABEL_EDGE_ACTION_ID, opts: { id: 'weasel-diagram-label-drag.click' } },
      { spec: { kind: 'doubleClick', target }, actionId: EDIT_EDGE_LABEL_ACTION_ID, opts: { id: 'weasel-diagram-label-drag.doubleClick' } },
    ],
  };
}
