import { defineAction, type Action, type ActionParamsOf, type BoundGesture } from '@weasel-js/routing';
import { wheelPan } from 'core/viewport/wheelHandler';

/**
 * Wheel and trackpad pan. Shift+wheel pans horizontally, by routing deltaY
 * into the x axis (`params.swapAxis`). `params.axis` locks the pan to one
 * axis, and outranks `swapAxis`: a shift-wheel routed into a barred axis
 * moves nothing.
 */
export const viewportWheelPanAction = defineAction({
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
      const axis = params?.axis ?? 'both';
      const deltaX = params?.deltaX ?? 0;
      const deltaY = params?.deltaY ?? 0;
      const from = view.get();
      const next = wheelPan(from, { deltaX, deltaY }, { axis, swapAxis: params?.swapAxis === true });
      view.set(next);
      deps.debug?.recordViewport('pan', from, next);
    },
  },
  enabled: () => true,
});

/** Tuning for {@link createViewportWheelPanAction}. */
export interface ViewportWheelPanOptions {
  /** Lock the pan to one axis. Default `'both'`. */
  axis?: 'both' | 'x' | 'y';
}

/** Builds a `viewport.wheelPan` descriptor with `opts` baked into both of its
 *  default bindings. `viewportWheelPanAction` is the unconfigured one. */
export function createViewportWheelPanAction(
  opts: ViewportWheelPanOptions = {},
): Action {
  const axis = opts.axis ?? 'both';
  const defaultBinding: BoundGesture<ActionParamsOf<'viewport.wheelPan'>>[] = [
    { spec: { kind: 'wheel' }, opts: { id: 'viewport.wheelPan.wheel', params: { axis } } },
    { spec: { kind: 'wheel', mods: { shift: true } }, opts: { id: 'viewport.wheelPan.swapAxis', params: { swapAxis: true, axis } } },
  ];
  return { ...viewportWheelPanAction, defaultBinding };
}
