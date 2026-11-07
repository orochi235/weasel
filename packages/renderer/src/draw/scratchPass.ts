import type { Paint } from '@weasel-js/paint';
import { getPaintDrawKind } from '../paintKinds';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { GpuTexture } from '../gpu/types';
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { setProjAndModel } from './uniforms';
import { returnToRenderTarget } from './effects';
import { BATCH_MODEL } from './flushBatch';
import { bindPaintKind } from './paintBind';

const UNBLENDED = { blend: null } as const;

export interface ScreenRect { x0: number; y0: number; x1: number; y1: number }

/** The unit square, stretched over the region a scratch paint covers. */
const UNIT_QUAD: Mesh = {
  vertices: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

interface ScratchPaint {
  texture: GpuTexture;
  /** Screen position → the texture coordinate the paint landed at there. */
  uvFromScreen: Float32Array;
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
  if (!scratch || !getPaintDrawKind(fill.kind)?.bind) return null;
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

  const gpu = ctx.gpu;
  const target = scratch.acquire(pw, ph);
  gpu.endPass();
  gpu.beginPass({ target: target.target, viewport: { x: 0, y: 0, width: pw, height: ph }, clear: { color: true } });

  const prog = bindPaintKind(ctx, fill, model, proj);
  if (prog) {
    const quad = ctx.meshCache.uploadRecurring(UNIT_QUAD);
    drawTriangles(ctx, prog, quad.geometry, UNIT_QUAD.indices.length, UNBLENDED);
  }

  returnToRenderTarget(ctx);
  if (!prog) return null;
  return {
    texture: target.target.color!,
    uvFromScreen: new Float32Array([
      ratio / target.width, 0, 0,
      0, ratio / target.height, 0,
      -px0 / target.width, -py0 / target.height, 1,
    ]),
  };
}

/** Bind the glyph program to sample `painted` as its paint. */
export function bindScratchPaint(ctx: DrawContext, prog: ShaderProgram, painted: ScratchPaint): ShaderProgram {
  setProjAndModel(ctx, prog, BATCH_MODEL);
  prog.set('u_worldInv', 'mat3', painted.uvFromScreen);
  prog.setTexture('u_sampler', painted.texture);
  return prog;
}
