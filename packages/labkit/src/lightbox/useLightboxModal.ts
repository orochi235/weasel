import { useLatest } from '@weasel-js/core';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
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

  // Lift and trap before paint, so the first frame is already the expanded
  // one. The popover attribute is set here rather than rendered: a closed
  // popover is `display: none`, which would hide the tile. New layers while
  // open re-lift without moving focus: whatever had it inside gets it back.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!expanded || !el) return;
    const stack = [...layers.below, el, ...layers.above].filter(
      (layer): layer is HTMLElement => layer !== null,
    );
    const focused = document.activeElement;
    const unlift = liftStack(stack, el);
    const release = inertOutside(stack);
    // A shared buffer lifted with this one must stop painting every other tile
    // over it. A tile inside a lifted layer came along too, so it stays.
    surface?.scope(stack);
    if (focused instanceof HTMLElement && focused !== document.activeElement && focused.isConnected)
      focused.focus({ preventScroll: true });
    return () => {
      surface?.scope(null);
      release();
      unlift();
    };
  }, [expanded, layers, surface, rootRef]);

  // Declared after the lift, so focus moves once the stack is up. Focus
  // returns in the setup of the closing render: React's commit puts back
  // whatever was focused before it, undoing a move made in a cleanup.
  const returnTo = useRef<HTMLElement | null>(null);
  const unmounting = useRef(false);
  useLayoutEffect(() => {
    unmounting.current = false;
    return () => {
      unmounting.current = true;
    };
  }, []);
  useLayoutEffect(() => {
    const back = (): void => {
      const target = returnTo.current;
      returnTo.current = null;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
    if (!expanded) return back();
    if (!rootRef.current) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    focusOnOpen.current?.focus({ preventScroll: true });
    // Unmounting while open: nothing renders closed after this.
    return () => {
      if (unmounting.current) back();
    };
  }, [expanded, rootRef, focusOnOpen]);

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
