/** The WebKit trackpad pinch channel: `gesturestart` / `gesturechange` / `gestureend` as `pinch` steps. */
import type { DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import { underPointer } from '../underPointer';

export function webkitPinchInput(core: DispatchCore): {
  onGestureStart: (e: Event) => void;
  onGestureChange: (e: Event) => void;
  onGestureEnd: (e: Event) => void;
  /** Whether a claimed pinch is live, in which case it is the only driver. */
  live: () => boolean;
  end: () => void;
} {
  const { canvas, routeAt, toWorld, target, dispatch, dispatcherNow, ctxNow } = core;

  // Set on a `gesturestart` some binding claims, cleared on its end. `scale`
  // and `rotation` on a GestureEvent are cumulative from the start; these
  // hold the previous sample's so each dispatched `pinch` is a step.
  let pinchLive = false;
  let pinchScale = 1;
  let pinchRotation = 0;

  const endPinch = (): void => {
    pinchLive = false;
    pinchScale = 1;
    pinchRotation = 0;
  };

  const pinchEventOf = (e: Event, scale: number, rotation: number): InputEvent => {
    const g = e as Event & {
      clientX?: number; clientY?: number;
      altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean;
    };
    // A focal point is part of the WebKit shape; the canvas center stands
    // in for an embedder that leaves it off.
    const rect = typeof g.clientX === 'number' && typeof g.clientY === 'number'
      ? undefined : canvas?.getBoundingClientRect();
    const cx = typeof g.clientX === 'number' ? g.clientX : (rect ? rect.left + rect.width / 2 : 0);
    const cy = typeof g.clientY === 'number' ? g.clientY : (rect ? rect.top + rect.height / 2 : 0);
    routeAt(null, cx, cy);
    const local = core.toCanvasLocal(cx, cy);
    const hitPoint = toWorld(cx, cy);
    const mods = {
      altKey: g.altKey === true, ctrlKey: g.ctrlKey === true,
      metaKey: g.metaKey === true, shiftKey: g.shiftKey === true,
    };
    return {
      kind: 'pinch',
      scale,
      rotation,
      clientX: local.x,
      clientY: local.y,
      ...underPointer(target(), mods, hitPoint),
    };
  };

  const onGestureStart = (e: Event) => {
    endPinch();
    // Claimed up front, with a probe at unit scale: Safari starts its own
    // page zoom from an unprevented start, before any change arrives.
    // `direction`-filtered bindings cannot match a unit step, so they are
    // resolved per change instead and do not claim the start.
    const probe = pinchEventOf(e, 1, 0);
    if (dispatcherNow().resolveOnly(probe, ctxNow()) === null) return;
    pinchLive = true;
    e.preventDefault();
  };

  const onGestureChange = (e: Event) => {
    const g = e as Event & { scale?: number; rotation?: number };
    const scale = typeof g.scale === 'number' && g.scale > 0 ? g.scale : pinchScale;
    const rotation = typeof g.rotation === 'number' ? g.rotation : pinchRotation;
    const step = scale / pinchScale;
    const turn = rotation - pinchRotation;
    pinchScale = scale;
    pinchRotation = rotation;
    if (dispatch(pinchEventOf(e, step, turn)) === 'handled') {
      pinchLive = true;
      e.preventDefault();
    } else if (pinchLive) {
      // The start was claimed; letting one change through would hand the
      // rest of the pinch to Safari's page zoom mid-gesture.
      e.preventDefault();
    }
  };

  const onGestureEnd = (e: Event) => {
    if (pinchLive) e.preventDefault();
    endPinch();
  };

  return { onGestureStart, onGestureChange, onGestureEnd, live: () => pinchLive, end: endPinch };
}
