/**
 * `useViewportActions` — conditionally register the `viewport.pan` and
 * `viewport.zoom` action descriptors based on SceneCanvas's `viewport` prop.
 *
 * These two descriptors are SceneCanvas-coupled (they need the `view` dep
 * that only SceneCanvas publishes via `useViewDepSource`), so they live
 * outside `KIT_STANDARD_DESCRIPTORS` and are wired here instead.
 *
 * Defaults: both `pan` and `zoom` are ON when omitted. Pass `pan: false` or
 * `zoom: false` on the `viewport` prop to disable.
 */
import { useEffect, useRef } from 'react';
import { useActionsRegistry } from 'interactions/actions/registry';
import { viewportWheelPanAction } from 'interactions/actions/defaults/viewportWheelPan';
import {
  makeViewportZoomAction,
  type ViewportZoomOptions,
} from 'interactions/actions/defaults/viewportZoom';

export function useViewportActions(args: {
  pan: boolean;
  /** `true`/`false` toggles the default Cmd+wheel zoom; an object tunes the
   *  wheel trigger + scale clamp (see {@link ViewportZoomOptions}). */
  zoom: boolean | ViewportZoomOptions;
}): void {
  const { pan, zoom } = args;
  const reg = useActionsRegistry();
  const regRef = useRef(reg);
  regRef.current = reg;

  // Serialize the zoom config so the effect re-runs when its fields change
  // (object identity isn't stable across renders for inline literals).
  const zoomKey = typeof zoom === 'object' ? JSON.stringify(zoom) : String(zoom);

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
    return () => { for (const u of unregisters) u(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zoom tracked via zoomKey
  }, [pan, zoomKey]);
}
