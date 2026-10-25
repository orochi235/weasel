import { useEffect } from 'react';
import { intoFrames } from './intoFrames';
import { probeUnderLens } from './probeUnderLens';
import { scrollByWheel } from './scrollByWheel';

/** Hands a wheel over a hit box to whatever lies beneath the lens layer, so a
 *  trial's camera still zooms and a story's scroller still scrolls under a lens,
 *  inside an isolated story's frame as well. The lens itself binds no wheel. */
export function useWheelPassThrough(input: HTMLElement | null, layer: HTMLElement | null) {
  useEffect(() => {
    if (!input || !layer) return;
    const onWheel = (e: WheelEvent): void => {
      const hit = probeUnderLens(layer, 'beneath', () =>
        document.elementFromPoint(e.clientX, e.clientY),
      );
      if (!hit || layer.contains(hit)) return;
      const beneath = intoFrames(hit, e.clientX, e.clientY);
      e.stopPropagation();
      // A frame's listeners test the wheel against their own realm's WheelEvent.
      const View = (beneath.el.ownerDocument.defaultView ?? window) as Window & typeof globalThis;
      const copy = new View.WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        composed: true,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: beneath.x,
        clientY: beneath.y,
        screenX: e.screenX,
        screenY: e.screenY,
        buttons: e.buttons,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
      // A browser scrolls nothing for the untrusted copy, and the original would scroll the lens's own ancestors.
      if (!beneath.el.dispatchEvent(copy) || scrollByWheel(beneath.el, copy)) e.preventDefault();
    };
    input.addEventListener('wheel', onWheel, { passive: false });
    return () => input.removeEventListener('wheel', onWheel);
  }, [input, layer]);
}
