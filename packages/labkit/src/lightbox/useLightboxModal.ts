import { useLatest } from '@weasel-js/core';
import { type RefObject, useEffect, useLayoutEffect } from 'react';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { useLightboxLayers } from './LightboxLayers';
import { inertOutside, liftStack } from './modal';

/** The open lightboxes, oldest first. Escape closes only the last: with one
 *  open inside another, every one hears the key on the document, and the outer
 *  one, listening longest, would hear it first. */
const openOrder: object[] = [];

/**
 * While `expanded`, make the root a modal: lift it and the `<LightboxLayers>` around it into the top layer,
 * make the rest of the page inert, scope a labkit surface above to it, focus `focusOnOpen`, and close on
 * Escape through `set` when it is the most recently opened lightbox still open. Closing returns focus to wherever it was.
 */
export function useLightboxModal(
  expanded: boolean,
  rootRef: RefObject<HTMLElement | null>,
  focusOnOpen: RefObject<HTMLElement | null>,
  set: (expanded: boolean) => void,
): void {
  const layers = useLightboxLayers();
  const surface = useSurfaceOptional();
  // Read through a ref: a new `set` must not move this lightbox to the top of `openOrder`.
  const setRef = useLatest(set);

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
    const me = {};
    openOrder.push(me);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented || openOrder.at(-1) !== me) return;
      e.preventDefault();
      setRef.current(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openOrder.splice(openOrder.indexOf(me), 1);
    };
  }, [expanded, setRef]);
}
