import type { InvocationCtx, OngoingHandle } from '../actions/invoker';
import { isEmptyOngoingHandle } from './inFlightGestures';

/**
 * The handle for a drag whose action starts only once the pointer has traveled `thresholdPx` on
 * screen from the press. Until then it holds the gesture and answers nothing else; past it, `start`
 * runs and every read goes to the handle it returns, beginning with the move that crossed. A `start`
 * that declines, with an empty handle, passes the drag on, as it would have fallen through at the
 * press. A release short of the threshold ends a gesture that never started. A `start` that throws is
 * handed to `threw`, which ends the drag, and is never called again.
 */
export function deferredStart(
  start: () => OngoingHandle, thresholdPx: number, threw: (err: unknown) => void,
): OngoingHandle {
  let inner: OngoingHandle | null = null;
  let failed = false;
  const onMove = (ctx: InvocationCtx): void | 'pass' => {
    if (!inner) {
      const travel = ctx.drag?.screenDelta;
      if (failed || !travel || Math.hypot(travel.x, travel.y) < thresholdPx) return;
      try {
        inner = start();
      } catch (err) {
        failed = true;
        threw(err);
        return;
      }
      if (isEmptyOngoingHandle(inner)) return 'pass';
    }
    return inner.onMove?.(ctx);
  };
  const onEnd = (ctx: InvocationCtx, reason: 'commit' | 'cancel'): void => {
    inner?.onEnd?.(ctx, reason);
  };
  // A proxy rather than a copy of each field: an absent method and one answering null mean
  // different things to the canvas (`previewPose`), so each must be absent until the action starts.
  const read = (key: PropertyKey): unknown => {
    if (key === 'onMove') return onMove;
    if (key === 'onEnd') return onEnd;
    if (!inner) return undefined;
    const value: unknown = Reflect.get(inner, key);
    return typeof value === 'function' ? value.bind(inner) : value;
  };
  return new Proxy({} as OngoingHandle, {
    get: (_target, key) => read(key),
    has: (_target, key) => read(key) !== undefined,
  });
}
