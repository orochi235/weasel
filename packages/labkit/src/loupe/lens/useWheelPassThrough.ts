import { useEffect } from 'react';
import { probeUnderLens } from './probeUnderLens';
import { scrollByWheel } from './scrollByWheel';

/** Hands a wheel over a hit box to whatever lies beneath the lens layer, so a
 *  trial's camera still zooms and a story's scroller still scrolls under a lens.
 *  The lens itself binds no wheel. */
export function useWheelPassThrough(input: HTMLElement | null, layer: HTMLElement | null) {
  useEffect(() => {
    if (!input || !layer) return;
    const onWheel = (e: WheelEvent): void => {
      const beneath = probeUnderLens(layer, 'beneath', () =>
        document.elementFromPoint(e.clientX, e.clientY),
      );
      if (!beneath || layer.contains(beneath)) return;
      e.stopPropagation();
      const copy = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        composed: true,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        buttons: e.buttons,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
      // A browser scrolls nothing for the untrusted copy, and the original would scroll the lens's own ancestors.
      if (!beneath.dispatchEvent(copy) || scrollByWheel(beneath, copy)) e.preventDefault();
    };
    input.addEventListener('wheel', onWheel, { passive: false });
    return () => input.removeEventListener('wheel', onWheel);
  }, [input, layer]);
}
