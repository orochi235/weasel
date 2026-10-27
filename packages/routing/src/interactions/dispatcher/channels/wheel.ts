/** The wheel channel. */
import type { DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import { underPointer } from '../underPointer';

/** A line's height in CSS pixels, as browsers that report pixels scroll one. */
const LINE_PX = 16;

/** What one unit of `e`'s deltas is in CSS pixels. Firefox counts a mouse
 *  wheel's notches in lines, and every rate downstream is per pixel. */
function pixelsPer(e: WheelEvent, canvas: HTMLElement | null): number {
  if (e.deltaMode === 1) return LINE_PX;
  if (e.deltaMode === 2) return canvas?.clientHeight || LINE_PX * 20;
  return 1;
}

export function wheelInput(core: DispatchCore, pinchLive: () => boolean): (e: WheelEvent) => void {
  const { routeAt, toWorld, target, dispatch } = core;

  const onWheel = (e: WheelEvent) => {
    core.activate();
    // Safari can report one trackpad pinch as both a gesture stream and
    // ctrl+wheel. While a claimed gesture is live it is the only driver.
    if (pinchLive() && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    routeAt(null, e.clientX, e.clientY);
    // Canvas-local, not client: an anchored wheel zoom would otherwise drift
    // by the canvas's offset from the viewport's top-left.
    const local = core.toCanvasLocal(e.clientX, e.clientY);
    const hitPoint = toWorld(e.clientX, e.clientY);
    const toPx = pixelsPer(e, core.canvas);
    const ev: InputEvent = {
      kind: 'wheel',
      deltaX: e.deltaX * toPx,
      deltaY: e.deltaY * toPx,
      clientX: local.x,
      clientY: local.y,
      x: hitPoint.x,
      y: hitPoint.y,
      ...underPointer(target(), e, hitPoint),
    };
    const result = dispatch(ev);
    // A claimed wheel neither scrolls the page nor reaches the canvas's other listeners
    // (a host's camera would zoom under a loupe); capture phase lets this run first.
    if (result === 'handled') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  return onWheel;
}
