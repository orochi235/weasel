import type { InvocationCtx, OngoingHandle } from '../actions/invoker';

/**
 * The handle for a drag whose action starts only once the pointer has traveled `thresholdPx` on
 * screen from the press. Until then it holds the gesture and answers nothing else; past it, `start`
 * runs and every read goes to the handle it returns, beginning with the move that crossed. A release
 * short of the threshold ends a gesture that never started.
 */
export function deferredStart(start: () => OngoingHandle, thresholdPx: number): OngoingHandle {
  let inner: OngoingHandle | null = null;
  const onMove = (ctx: InvocationCtx): void | 'pass' => {
    if (!inner) {
      const travel = ctx.drag?.screenDelta;
      if (!travel || Math.hypot(travel.x, travel.y) < thresholdPx) return;
      inner = start();
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
