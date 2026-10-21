import type { Action } from '@weasel-js/routing';
import { wheelPan } from 'core/viewport/wheelHandler';

/**
 * Wheel and trackpad pan. Shift+wheel pans horizontally, by routing deltaY
 * into the x axis (`params.swapAxis`). `params.axis` locks the pan to one
 * axis, and outranks `swapAxis`: a shift-wheel routed into a barred axis
 * moves nothing.
 */
export const viewportWheelPanAction: Action & { requires: string[] } = {
  id: 'viewport.wheelPan',
  label: 'Pan (wheel)',
  group: 'viewport',
  /**
   * The matcher's strict modifier check keeps the bindings exclusive, and
   * leaves Cmd+wheel to `viewportZoomAction`: omitting `mods` forbids any
   * modifier, and `mods: { shift: true }` forbids the others.
   */
  defaultBinding: [
    { spec: { kind: 'wheel' }, opts: { id: 'viewport.wheelPan.wheel' } },
    { spec: { kind: 'wheel', mods: { shift: true } }, opts: { id: 'viewport.wheelPan.swapAxis', params: { swapAxis: true } } },
  ],
  requires: ['view', 'debug'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const view = deps.view;
      if (!view) return;
      const axis = (params?.axis as 'both' | 'x' | 'y' | undefined) ?? 'both';
      const deltaX = (params?.deltaX as number | undefined) ?? 0;
      const deltaY = (params?.deltaY as number | undefined) ?? 0;
      const from = view.get();
      const next = wheelPan(from, { deltaX, deltaY }, { axis, swapAxis: params?.swapAxis === true });
      view.set(next);
      deps.debug?.recordViewport('pan', from, next);
    },
  },
  enabled: () => true,
};

/** Tuning for {@link makeViewportWheelPanAction}. */
export interface WheelPanOptions {
  /** Lock the pan to one axis. Default `'both'`. */
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
      { spec: { kind: 'wheel' }, opts: { id: 'viewport.wheelPan.wheel', params: { axis } } },
      { spec: { kind: 'wheel', mods: { shift: true } }, opts: { id: 'viewport.wheelPan.swapAxis', params: { swapAxis: true, axis } } },
    ],
  };
}
