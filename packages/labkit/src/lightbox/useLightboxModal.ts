import { type RefObject, useEffect, useLayoutEffect } from 'react';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { useLightboxLayers } from './LightboxLayers';
import { inertOutside, liftStack } from './modal';

/**
 * While `expanded`, make the root a modal: lift it and the `<LightboxLayers>` around it into the top layer,
 * make the rest of the page inert, scope a labkit surface above to it, focus `focusOnOpen`, and close on
 * Escape through `set`. Closing returns focus to wherever it was.
 */
export function useLightboxModal(
  expanded: boolean,
  rootRef: RefObject<HTMLElement | null>,
  focusOnOpen: RefObject<HTMLElement | null>,
  set: (expanded: boolean) => void,
): void {
  const layers = useLightboxLayers();
  const surface = useSurfaceOptional();

  // Lift, trap and focus before paint, so the first frame is already the
  // expanded one. The popover attribute is set here rather than rendered: a
  // closed popover is `display: none`, which would hide the tile.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!expanded || !el) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const stack = [...layers.below, el, ...layers.above].filter(
      (layer): layer is HTMLElement => layer !== null,
    );
    const unlift = liftStack(stack, el);
    const release = inertOutside(stack);
    // A shared buffer lifted with this one must stop painting every other tile
    // over it. A tile inside a lifted layer came along too, so it stays.
    surface?.scope(stack);
    focusOnOpen.current?.focus({ preventScroll: true });
    return () => {
      surface?.scope(null);
      release();
      unlift();
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [expanded, layers, surface, rootRef, focusOnOpen]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      set(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, set]);
}
