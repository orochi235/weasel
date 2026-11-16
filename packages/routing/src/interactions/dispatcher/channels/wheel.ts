/** The wheel channel. */
import { landedNestedIn, type DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import { WHEEL_LINE_PX, wheelPixels } from '@weasel-js/ui-input';
import { underPointer } from '../underPointer';

/** How far a page-mode wheel's page goes: the canvas, or twenty lines without one. Every rate downstream is per pixel. */
const pageOf = (canvas: HTMLElement | null): { x: number; y: number } => ({
  x: canvas?.clientWidth || WHEEL_LINE_PX * 20,
  y: canvas?.clientHeight || WHEEL_LINE_PX * 20,
});

/**
 * The wheel listeners for the capture and bubble phases. A wheel that landed on
 * this surface is handled while capturing, ahead of the element's other wheel
 * listeners; one that landed in a surface nested inside waits for the bubble,
 * after that surface has had it and left it.
 */
export function wheelInput(core: DispatchCore, pinchLive: () => boolean): {
  capture: (e: WheelEvent) => void;
  bubble: (e: WheelEvent) => void;
} {
  const { routeAt, toWorld, target, dispatch } = core;

  const onWheel = (e: WheelEvent) => {
    core.activate(e);
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
    const px = wheelPixels(e, pageOf(core.canvas));
    const ev: InputEvent = {
      kind: 'wheel',
      deltaX: px.x,
      deltaY: px.y,
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

  return {
    capture: (e) => { if (!landedNestedIn(core.canvas, e)) onWheel(e); },
    bubble: (e) => { if (landedNestedIn(core.canvas, e)) onWheel(e); },
  };
}
