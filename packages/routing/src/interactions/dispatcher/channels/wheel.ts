/** The wheel channel. */
import { clientToCanvasRect } from '../../../viewport/clientToCanvas';
import type { DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';

export function wheelInput(core: DispatchCore, pinchLive: () => boolean): (e: WheelEvent) => void {
  const { canvas, routeAt, toWorld, target, dispatch } = core;

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
    // Convert client-space cursor to canvas-local: zoomAt() (and any other
    // wheel consumer of clientX/Y) anchors in canvas-top-left coords, not
    // viewport coords. Without this, anchored-wheel zoom drifts by the
    // canvas's offset from the viewport top-left.
    const rect = canvas?.getBoundingClientRect();
    const [localX, localY] = rect
      ? clientToCanvasRect(rect, e.clientX, e.clientY)
      : [e.clientX, e.clientY];
    const hitPoint = toWorld(e.clientX, e.clientY);
    const affordance = target().affordanceAt?.(hitPoint) ?? undefined;
    const body = target().classifyTarget?.(hitPoint);
    const ev: InputEvent = {
      kind: 'wheel',
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      clientX: localX,
      clientY: localY,
      ...(affordance !== undefined ? { affordance } : {}),
      ...(body?.body !== undefined ? { bodyTarget: body.body } : {}),
      ...(body?.kind !== undefined ? { bodyKind: body.kind } : {}),
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
