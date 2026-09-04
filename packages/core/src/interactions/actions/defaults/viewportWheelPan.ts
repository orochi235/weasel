/**
 * `viewportWheelPanAction` — immediate Action descriptor for wheel-based viewport pan.
 *
 * ## Bindings
 * - Plain wheel (no mod) → pan by deltaX/deltaY
 * - Shift+wheel → horizontal pan (mouse-wheel users get a horizontal axis
 *   without a horizontal scroll device). Implemented by routing deltaY into
 *   the x axis when the spec carries `params.swapAxis: true`.
 *
 * ## Design notes
 * The dispatcher merges wheel event data (deltaX, deltaY, clientX, clientY)
 * into params at dispatch time. The invoker
 * reads them from the params bag.
 *
 * Pan delta is divided by view.scale so that one screen-pixel scroll equals
 * one screen-pixel pan at any zoom level.
 *
 * `axis` locks the pan to one axis, matching `viewport.dragPan`'s param of
 * the same name, so a consumer that wants a single-axis viewport can say so
 * once per action instead of clamping every committed view. An axis lock
 * outranks `swapAxis`: a shift-wheel routed into a barred axis moves nothing.
 */

import type { Action } from '../registry';
import type { ViewApi } from '../depSchema';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `viewport.wheelPan` Action.
 *
 * Companion to `viewport.dragPan` (drag-to-pan via the hand tool /
 * space-held). This one is the wheel/trackpad path; both share the
 * same `view` dep but fire on different gesture kinds, so they
 * coexist without competing.
 *
 * Requires dep-schema entry: `view`.
 */
export const viewportWheelPanAction: Action & { requires: string[] } = {
  id: 'viewport.wheelPan',
  label: 'Pan (wheel)',
  group: 'viewport',
  /**
   * Plain wheel → pan; Shift+wheel → horizontal pan (axis swap).
   * Cmd+wheel is claimed by `viewportZoomAction`. The matcher's strict
   * modifier check keeps the bindings exclusive: omitting `mods` forbids
   * any modifier, and `mods: { shift: true }` forbids the others.
   */
  defaultBinding: [
    { spec: { kind: 'wheel' }, opts: {} },
    { spec: { kind: 'wheel', mods: { shift: true } }, opts: { params: { swapAxis: true } } },
  ],
  requires: ['view'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const view = deps.view as ViewApi | undefined;
      if (!view) return;
      const axis = (params?.axis as 'both' | 'x' | 'y' | undefined) ?? 'both';
      const deltaX = (params?.deltaX as number | undefined) ?? 0;
      const deltaY = (params?.deltaY as number | undefined) ?? 0;
      const current = view.get();
      // Divide by scale so one screen-pixel scroll = one screen-pixel pan.
      // For shift+wheel, route deltaY into the x axis so mouse-wheel users
      // (who only emit deltaY) get a horizontal pan. Fall back to deltaX
      // when present so the binding still behaves on trackpad horizontal swipes.
      const swap = params?.swapAxis === true;
      const dx = swap ? (deltaX !== 0 ? deltaX : deltaY) / current.scale.x : deltaX / current.scale.x;
      const dy = swap ? 0 : deltaY / current.scale.y;
      view.set({
        ...current,
        x: current.x + (axis === 'y' ? 0 : dx),
        y: current.y + (axis === 'x' ? 0 : dy),
      });
    },
  },
  enabled: () => true,
};

/** Tuning for {@link makeViewportWheelPanAction}. */
export interface WheelPanOptions {
  /** Lock the pan to one axis. Default `'both'`. Mirrors `viewport.dragPan`'s
   *  `axis` param, so a single-axis viewport is declared once per action
   *  rather than clamped on every committed view. */
  axis?: 'both' | 'x' | 'y';
}

/** Builds a `viewport.wheelPan` descriptor with `opts` baked into both of its
 *  default bindings. `viewportWheelPanAction` is the unconfigured one. */
export function makeViewportWheelPanAction(
  opts: WheelPanOptions = {},
): Action & { requires: string[] } {
  const axis = opts.axis ?? 'both';
  return {
    ...viewportWheelPanAction,
    defaultBinding: [
      { spec: { kind: 'wheel' }, opts: { params: { axis } } },
      { spec: { kind: 'wheel', mods: { shift: true } }, opts: { params: { swapAxis: true, axis } } },
    ],
  };
}
