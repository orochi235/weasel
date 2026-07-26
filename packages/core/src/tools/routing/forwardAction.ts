import type { ActionFn } from './types';
import { claim, none } from './result';

/**
 * Build an `ActionFn` that forwards `ctx` + the raw DOM event to a
 * consumer-supplied callback and claims the gesture.
 *
 * Useful for tools that want to expose an escape-hatch hook for app
 * code without losing routing: route the gesture declaratively, then
 * fall through to the consumer when the kit doesn't have a better
 * default. The consumer-payload shape is whatever the tool wants —
 * `buildPayload` produces it from `ctx` and the raw event.
 *
 * When `callbackRef.current` is null/undefined, returns `none()` so
 * the routing engine continues to the next route (e.g. an ambient
 * tool's handler).
 *
 * Typical use, inside a `useFooTool` hook:
 *
 *     const onDoubleTapRef = useRef(options.onDoubleTap);
 *     onDoubleTapRef.current = options.onDoubleTap;
 *     const forwardDblTap = forwardActionTo<FooScratch, DblTapPayload>(
 *       onDoubleTapRef,
 *       (ctx, e) => ({
 *         worldX: ctx.worldX,
 *         worldY: ctx.worldY,
 *         event: e as PointerEvent,
 *       }),
 *     );
 *     // ...later, in the route table:
 *     dblTap: { '*': forwardDblTap, empty: forwardDblTap }
 */
export function forwardActionTo<TScratch, TPayload>(
  callbackRef: { readonly current: ((payload: TPayload) => void) | null | undefined },
  buildPayload: (
    ctx: Parameters<ActionFn<TScratch>>[0],
    event: Parameters<ActionFn<TScratch>>[1],
  ) => TPayload,
): ActionFn<TScratch> {
  return (ctx, event) => {
    const cb = callbackRef.current;
    if (!cb) return none();
    cb(buildPayload(ctx, event));
    return claim();
  };
}
