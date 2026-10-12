import type { DrawContext } from './drawContext';

/** Every GL draw the renderer issues goes through here, so the frame's
 *  draw-call count cannot miss one. */
export function drawTriangles(ctx: DrawContext, count: number, type: number): void {
  ctx.gl.drawElements(ctx.gl.TRIANGLES, count, type, 0);
  if (ctx.stats) ctx.stats.drawCalls++;
}
