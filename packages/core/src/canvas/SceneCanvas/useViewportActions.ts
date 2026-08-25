/**
 * `useViewportActions` — register the `viewport.pan`, `viewport.zoom` and
 * `viewport.pinchZoom` action descriptors from SceneCanvas's `viewport` prop.
 *
 * All three need the `view` dep that only SceneCanvas publishes via
 * `useViewDepSource`. `pan` and `zoom` live outside `KIT_STANDARD_DESCRIPTORS`
 * entirely and are registered here; `pinchZoom` is in that list (bare
 * `useStandardActions` consumers get it too), so this hook only re-registers a
 * clamp-configured one over it, or takes it away.
 *
 * Defaults: all three ON when omitted. Pass `pan: false` / `zoom: false` /
 * `pinchZoom: false` on the `viewport` prop to disable.
 *
 * Runs after `useStandardActions` in the same component, so the registry's
 * last-writer-wins ordering resolves the `pinchZoom` overlap.
 */
import { useEffect, useRef } from 'react';
import { useActionsRegistry } from 'interactions/actions/registry';
import { viewportWheelPanAction } from 'interactions/actions/defaults/viewportWheelPan';
import {
  makeViewportZoomAction,
  type ViewportZoomOptions,
} from 'interactions/actions/defaults/viewportZoom';
import {
  makePinchZoomAction,
  type PinchZoomOptions,
} from 'interactions/actions/defaults/pinchZoom';

export function useViewportActions(args: {
  pan: boolean;
  /** `true`/`false` toggles the default Cmd+wheel zoom; an object tunes the
   *  wheel trigger + scale clamp (see {@link ViewportZoomOptions}). */
  zoom: boolean | ViewportZoomOptions;
  /** `true`/`false` toggles two-finger pinch zoom; an object sets its scale
   *  clamp (see {@link PinchZoomOptions}). */
  pinchZoom: boolean | PinchZoomOptions;
}): void {
  const { pan, zoom, pinchZoom } = args;
  const reg = useActionsRegistry();
  const regRef = useRef(reg);
  regRef.current = reg;

  // Serialize the object configs so the effect re-runs when their fields change
  // (object identity isn't stable across renders for inline literals).
  // JSON.stringify drops function-valued fields, so changing only
  // `animate.easing` does not re-register — pass a stable easing.
  const zoomKey = typeof zoom === 'object' ? JSON.stringify(zoom) : String(zoom);
  const pinchKey = typeof pinchZoom === 'object' ? JSON.stringify(pinchZoom) : String(pinchZoom);

  useEffect(() => {
    const r = regRef.current;
    if (!r) return;
    const unregisters: Array<() => void> = [];
    if (pan) unregisters.push(r.register(viewportWheelPanAction));
    if (zoom) {
      const zoomAction =
        typeof zoom === 'object' ? makeViewportZoomAction(zoom) : makeViewportZoomAction();
      unregisters.push(r.register(zoomAction));
    }
    // Registered even for a bare `true`, so toggling back on after a `false`
    // restores it — the standard-descriptor entry it displaced is gone by then.
    if (pinchZoom) {
      unregisters.push(
        r.register(makePinchZoomAction(typeof pinchZoom === 'object' ? pinchZoom : {})),
      );
    } else {
      r.unregister('viewport.pinchZoom');
    }
    return () => { for (const u of unregisters) u(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configs tracked via zoomKey / pinchKey
  }, [pan, zoomKey, pinchKey]);
}
