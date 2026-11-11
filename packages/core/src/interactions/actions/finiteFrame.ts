import type { InvocationCtx } from '@weasel-js/routing';

/** Whether every number in `v`, however deep in its arrays, maps, and objects, is finite. */
export function finiteThroughout(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v === null || typeof v !== 'object') return true;
  if (ArrayBuffer.isView(v)) return Array.prototype.every.call(v, (n: unknown) => typeof n !== 'number' || Number.isFinite(n));
  if (v instanceof Map) return [...v.values()].every(finiteThroughout);
  return Object.values(v).every(finiteThroughout);
}

/**
 * A drag's next frame, built by `next` from the move `ctx`, or `prev` when the pointer is no finite number or what
 * the frame `shows` is no longer finite (a move carrying a pose past the double range): such a move lands nowhere,
 * and the drag goes on from the last frame that did.
 */
export function finiteFrame<F>(
  prev: F,
  ctx: Pick<InvocationCtx, 'world' | 'drag'>,
  next: () => F,
  shows: (frame: F) => unknown,
): F {
  if (!finiteThroughout(ctx.world) || !finiteThroughout(ctx.drag?.current)) return prev;
  const frame = next();
  return finiteThroughout(shows(frame)) ? frame : prev;
}
