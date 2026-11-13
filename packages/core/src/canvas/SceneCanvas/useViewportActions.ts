/**
 * Registers the wheel pan, zoom, and pinch zoom actions from SceneCanvas's
 * `viewport` prop, and the wheel scroll of a container whose content runs
 * past its bounds — first, so it is asked before the pan and yields to it
 * anywhere else.
 *
 * Wheel pan and zoom are registered only here. `pinchZoom` is also a kit
 * standard action, so this hook re-registers a configured one over it, or
 * mutes it — muting rather than unregistering, so a sibling canvas sharing the
 * registry keeps its own. That overlap is why this must run after
 * `useStandardActions`.
 */
import { useEffect } from 'react';
import type { Action } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { containerScrollAction } from 'interactions/actions/defaults/containerScroll';
import {
  createViewportWheelPanAction,
  type WheelPanOptions,
} from 'interactions/actions/defaults/viewportWheelPan';
import {
  createViewportZoomAction,
  type ViewportZoomOptions,
} from 'interactions/actions/defaults/viewportZoom';
import {
  createPinchZoomAction,
  type PinchZoomOptions,
} from 'interactions/actions/defaults/pinchZoom';

export function useViewportActions(args: {
  /** `true`/`false` toggles wheel pan; an object locks its axis (see
   *  {@link WheelPanOptions}). */
  pan: boolean | WheelPanOptions;
  /** `true`/`false` toggles the default Cmd+wheel zoom; an object tunes the
   *  wheel trigger + scale clamp (see {@link ViewportZoomOptions}). */
  zoom: boolean | ViewportZoomOptions;
  /** `true`/`false` toggles two-finger pinch zoom; an object sets its scale
   *  clamp (see {@link PinchZoomOptions}). */
  pinchZoom: boolean | PinchZoomOptions;
  /** Changes whenever the standard action set re-registers, which puts the
   *  default pinch zoom back on top of a configured one. */
  rev?: string;
}): void {
  const { pan, zoom, pinchZoom, rev } = args;
  const reg = useActionsRegistry();
  const regRef = useLatest(reg);
  const zoomRef = useLatest(zoom);

  // Serialized so the effect re-runs when a config's fields change, not its
  // identity. JSON.stringify drops function-valued fields (`animate.easing`,
  // `interpolator`, `onDone`), so the zoom runs from the latest config instead.
  const panKey = typeof pan === 'object' ? JSON.stringify(pan) : String(pan);
  const zoomKey = typeof zoom === 'object' ? JSON.stringify(zoom) : String(zoom);
  const pinchKey = typeof pinchZoom === 'object' ? JSON.stringify(pinchZoom) : String(pinchZoom);

  useEffect(() => {
    const r = regRef.current;
    if (!r) return;
    const unregisters: Array<() => void> = [r.register(containerScrollAction)];
    if (pan) {
      unregisters.push(
        r.register(createViewportWheelPanAction(typeof pan === 'object' ? pan : {})),
      );
    }
    if (zoom) unregisters.push(r.register(liveZoomAction(zoom, () => zoomRef.current)));
    if (pinchZoom) {
      unregisters.push(
        r.register(createPinchZoomAction(typeof pinchZoom === 'object' ? pinchZoom : {})),
      );
    } else {
      unregisters.push(r.mute('viewport.pinchZoom'));
    }
    return () => { for (const u of unregisters) u(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configs tracked via zoomKey / pinchKey
  }, [panKey, zoomKey, pinchKey, rev]);
}

/** `viewport.zoom` registered from `zoom`, each run built from the config `latest` reads then. Building is cheap
 *  and the action keeps nothing between runs. */
function liveZoomAction(zoom: true | ViewportZoomOptions, latest: () => boolean | ViewportZoomOptions): Action {
  const optionsOf = (z: boolean | ViewportZoomOptions) => (typeof z === 'object' ? z : {});
  const action = createViewportZoomAction(optionsOf(zoom));
  return {
    ...action,
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const now = createViewportZoomAction(optionsOf(latest())).invoker;
        return now?.timing === 'immediate' ? now.run(deps, params) : undefined;
      },
    },
  };
}

/**
 * `viewport.zoom` with `viewport.animatedZoom` folded in as the zoom action's
 * `animate` option, the way `pinchZoom` carries the pinch tool's clamp.
 */
export function viewportZoomOption(
  zoom: boolean | ViewportZoomOptions | undefined,
  animatedZoom: ViewportZoomOptions['animate'] | undefined,
): boolean | ViewportZoomOptions {
  if (zoom === false) return false;
  const base = typeof zoom === 'object' ? zoom : {};
  if (!animatedZoom) return base;
  return { ...base, animate: animatedZoom === true ? {} : animatedZoom };
}
