import { useEffect } from 'react';
import { probeUnderLens } from './probeUnderLens';

/** Hands a wheel over a hit box to whatever lies beneath the lens layer, so a
 *  trial's camera still zooms under a lens. The lens itself binds no wheel. */
export function useWheelPassThrough(input: HTMLElement | null, layer: HTMLElement | null) {
  useEffect(() => {
    if (!input || !layer) return;
    const onWheel = (e: WheelEvent): void => {
      const beneath = probeUnderLens(layer, 'beneath', () => document.elementFromPoint(e.clientX, e.clientY));
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
      if (!beneath.dispatchEvent(copy)) e.preventDefault();
    };
    input.addEventListener('wheel', onWheel, { passive: false });
    return () => input.removeEventListener('wheel', onWheel);
  }, [input, layer]);
}
