import type { DrawContext } from './drawContext';
import { drawBoth, prepareIdDraw } from './idFrame';

/** Every GL draw the renderer issues goes through here, so the frame's
 *  draw-call count cannot miss one, and an id frame's id reaches every draw. */
export function drawTriangles(ctx: DrawContext, count: number, type: number): void {
  const idsOff = ctx.ids ? prepareIdDraw(ctx, ctx.ids) : false;
  ctx.gl.drawElements(ctx.gl.TRIANGLES, count, type, 0);
  if (idsOff) drawBoth(ctx.gl);
  if (ctx.stats) ctx.stats.drawCalls++;
}
