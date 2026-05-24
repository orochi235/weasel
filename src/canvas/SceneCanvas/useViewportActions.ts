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
import { viewportPanAction } from 'interactions/actions/defaults/viewportPan';
import { viewportZoomAction } from 'interactions/actions/defaults/viewportZoom';

export function useViewportActions(args: { pan: boolean; zoom: boolean }): void {
  const { pan, zoom } = args;
  const reg = useActionsRegistry();
  const regRef = useRef(reg);
  regRef.current = reg;

  useEffect(() => {
    const r = regRef.current;
    if (!r) return;
    const unregisters: Array<() => void> = [];
    if (pan) unregisters.push(r.register(viewportPanAction));
    if (zoom) unregisters.push(r.register(viewportZoomAction));
    return () => { for (const u of unregisters) u(); };
  }, [pan, zoom]);
}
