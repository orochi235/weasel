import type { Action, Scene, SurfaceContribution } from '@weasel-js/core';
import { PLOT_DRAG_ACTION_ID, createPlotDragAction, type PlotDragOptions } from './dragAction';
import { PLOT_HANDLE_AFFORDANCE_KIND, plotHandleLayer } from './handleLayer';

/** The action id that absorbs a press on a handle, so it reaches neither marquee nor pan. */
export const GRAB_PLOT_HANDLE_ACTION_ID = 'plot.grabHandle';

const grabHandleAction: Action = {
  id: GRAB_PLOT_HANDLE_ACTION_ID,
  label: 'Grab chart handle',
  group: 'plot',
  invoker: { timing: 'immediate', run: () => {} },
  enabled: () => true as const,
};

/**
 * Editing a scene's plots by dragging, as one entry to pass as `ambient`: the
 * handle layer, and a drag on a handle bound to `plot.dragValue`.
 */
export function plotEditing(
  opts: PlotDragOptions & { scene: Scene<unknown, string, unknown> },
): SurfaceContribution {
  const actionId = opts.id ?? PLOT_DRAG_ACTION_ID;
  const target = `affordance:${PLOT_HANDLE_AFFORDANCE_KIND}` as const;
  return {
    id: 'weasel-plot-editing',
    eligibility: { claimed: true },
    layers: [plotHandleLayer(opts.scene)],
    actions: [createPlotDragAction({ ...opts, id: actionId }), grabHandleAction],
    bindings: [
      { spec: { kind: 'drag', target }, actionId, opts: { id: 'weasel-plot-editing.drag' } },
      { spec: { kind: 'pointerDown', target }, actionId: GRAB_PLOT_HANDLE_ACTION_ID, opts: { id: 'weasel-plot-editing.pointerDown' } },
      { spec: { kind: 'click', target }, actionId: GRAB_PLOT_HANDLE_ACTION_ID, opts: { id: 'weasel-plot-editing.click' } },
    ],
  };
}
