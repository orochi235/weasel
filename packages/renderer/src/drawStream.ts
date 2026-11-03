import type { DrawCommand } from './DrawCommand';
import { dispatch, flushBatch, type DrawContext } from './draw';
import type { RenderSpan, RenderSpanStats } from './rendererTypes';

export function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Draw a frame's top-level `commands` through `ctx`, accounting each of
 *  `spans` into `spanStats`, and flush what is left staged at the end. */
export function drawStream(
  ctx: DrawContext, commands: readonly DrawCommand[], spans: readonly RenderSpan[],
  spanStats: RenderSpanStats[], counters: { drawCalls: number },
): void {
  let next = 0;
  for (let si = 0; si < spans.length; si++) {
    const span = spans[si];
    for (; next < span.start; next++) dispatch(ctx, commands[next]);
    const drawsBefore = counters.drawCalls;
    const spanT0 = now();
    for (; next < span.end; next++) dispatch(ctx, commands[next]);
    // The stream's closing flush belongs to whatever it closes.
    if (si === spans.length - 1 && next >= commands.length) flushBatch(ctx);
    spanStats.push({ id: span.id, drawCalls: counters.drawCalls - drawsBefore, ms: now() - spanT0 });
  }
  for (; next < commands.length; next++) dispatch(ctx, commands[next]);
  // The stream ended, so whatever is still staged has nothing left that
  // could merge with it.
  flushBatch(ctx);
}
