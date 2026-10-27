import type { Paint } from '@weasel-js/paint';
import { getPaintDrawKind, type PaintBindContext } from '../paintKinds';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { GlMat3 } from '@weasel-js/geom';
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { setProjAndModel } from './uniforms';
import { returnToRenderTarget } from './effects';
import { BATCH_MODEL } from './flushBatch';
import { paintBindContext } from './paintBind';

export interface ScreenRect { x0: number; y0: number; x1: number; y1: number }

/** The unit square, stretched over the region a scratch paint covers. */
const UNIT_QUAD: Mesh = {
  vertices: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

interface ScratchPaint {
  texture: WebGLTexture;
  /** Screen position → the texture coordinate the paint landed at there. */
  uvFromScreen: GlMat3;
}

/**
 * Render a registered kind's paint over `rect` (screen px) into the renderer's
 * scratch buffer, through the kind's own `bind` — so any kind that paints a
 * path paints this, with nothing asked of it beyond what a path asks.
 *
 * The region is snapped out to the device-pixel grid and clamped to the
 * window of the drawing buffer the target holds, so each texel is one device pixel of the target and a glyph
 * fragment reads its own. The kind sees the same transform, alpha and paint
 * space it would for a path here; only the projection differs, aimed at the
 * scratch buffer instead of the target. No clip and no scissor apply inside:
 * the glyphs that sample the result are drawn under both.
 *
 * `null` when there is no scratch buffer, the region is empty, or the kind
 * declines the paint — and the glyphs then draw nothing, as the outline tier
 * does for a paint no kind binds.
 */
export function renderPaintToScratch(ctx: DrawContext, fill: Paint, rect: ScreenRect): ScratchPaint | null {
  const scratch = ctx.paintScratch;
  const bind = getPaintDrawKind(fill.kind)?.bind;
  if (!scratch || !bind) return null;
  const ratio = ctx.deviceWidth && ctx.widthCss > 0 ? ctx.deviceWidth / ctx.widthCss : 1;
  const deviceW = ctx.deviceWidth ?? Math.round(ctx.widthCss);
  const deviceH = ctx.deviceHeight ?? Math.round(ctx.heightCss);
  // The target's window: inside an effects buffer reaching past the drawing
  // buffer, glyphs there are drawn and need their paint too.
  const win = ctx.renderTarget?.window ?? { x: 0, y: 0, width: deviceW, height: deviceH };
  const px0 = Math.max(win.x, Math.floor(rect.x0 * ratio));
  const py0 = Math.max(win.y, Math.floor(rect.y0 * ratio));
  const maxSide = ctx.imageCache.maxTextureSide;
  const pw = Math.min(maxSide, Math.min(win.x + win.width, Math.ceil(rect.x1 * ratio)) - px0);
  const ph = Math.min(maxSide, Math.min(win.y + win.height, Math.ceil(rect.y1 * ratio)) - py0);
  if (!(pw > 0 && ph > 0)) return null;

  // The region in screen px, and the two matrices a kind's vertex stage
  // multiplies: the unit quad onto it, and it onto the whole of clip space.
  const x0 = px0 / ratio, y0 = py0 / ratio, w = pw / ratio, h = ph / ratio;
  const model = new Float32Array([w, 0, 0, 0, h, 0, x0, y0, 1]);
  const proj = new Float32Array([2 / w, 0, 0, 0, 2 / h, 0, -1 - (2 * x0) / w, -1 - (2 * y0) / h, 1]);
  const base = paintBindContext(ctx);
  const bindCtx: PaintBindContext = {
    ...base,
    alpha: ctx.state.alpha,
    maxTextureSize: base.maxTextureSize,
    setProjAndModel: (prog) => setProjAndModel(ctx, prog, model, proj),
  };

  const gl = ctx.gl;
  const target = scratch.acquire(pw, ph);
  const scissorWasOn = gl.isEnabled(gl.SCISSOR_TEST);
  // The last glyph pass left this texture bound to unit 0; a kind sampling a
  // unit it never binds would read the buffer it is drawing into.
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.viewport(0, 0, pw, ph);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.STENCIL_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.BLEND);

  const prog = bind(bindCtx, fill);
  if (prog) {
    gl.bindVertexArray(ctx.meshCache.uploadRecurring(UNIT_QUAD).vao);
    drawTriangles(ctx, UNIT_QUAD.indices.length, gl.UNSIGNED_INT);
    gl.bindVertexArray(null);
  }

  gl.enable(gl.BLEND);
  returnToRenderTarget(ctx, deviceW, deviceH, scissorWasOn);
  if (!prog) return null;
  return {
    texture: target.texture,
    uvFromScreen: new Float32Array([
      ratio / target.width, 0, 0,
      0, ratio / target.height, 0,
      -px0 / target.width, -py0 / target.height, 1,
    ]),
  };
}

/** Bind the glyph program to sample `painted` as its paint. */
export function bindScratchPaint(ctx: DrawContext, prog: ShaderProgram, painted: ScratchPaint): ShaderProgram {
  const gl = ctx.gl;
  gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog, BATCH_MODEL);
  gl.uniformMatrix3fv(prog.uniform('u_worldInv')!, false, painted.uvFromScreen);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, painted.texture);
  gl.uniform1i(prog.uniform('u_sampler')!, 0);
  return prog;
}
