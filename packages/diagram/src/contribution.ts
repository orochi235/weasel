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
