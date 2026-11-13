import type { ShaderProgram } from '../shaders/ShaderProgram';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { parseColor } from '@weasel-js/paint';
import type { DrawContext } from './drawContext';

/**
 * Uniform values a program already holds this frame, so an unchanged one is
 * not re-sent. Keyed on the `DrawContext`, which is built fresh per frame, so
 * the cache cannot outlive a frame and go stale against what the program holds.
 *
 * **Only for uniforms this module is the sole writer of.** A
 * `set4f('u_color', …)` added anywhere else leaves the cache believing
 * a value the program no longer has, and the wrong color is drawn until
 * something else moves it.
 */
interface UploadedUniforms {
  proj?: Float32Array;
  model?: Float32Array;
  colorMatrix?: Float32Array;
  colorBias?: Float32Array;
  originX?: number;
  originY?: number;
  /** Held as plain numbers, not a `Float32Array`: the caller's values are
   *  doubles, and round-tripping them through float32 would compare unequal
   *  every time and never skip an upload. */
  color?: [number, number, number, number];
  alpha?: number;
}

const FRAME_UPLOADS = new WeakMap<DrawContext, WeakMap<ShaderProgram, UploadedUniforms>>();

const FRAME_PROJ = new WeakMap<DrawContext, GlMat3>();

function uploadedFor(ctx: DrawContext, prog: ShaderProgram): UploadedUniforms {
  let byProgram = FRAME_UPLOADS.get(ctx);
  if (!byProgram) {
    byProgram = new WeakMap();
    FRAME_UPLOADS.set(ctx, byProgram);
  }
  let uploaded = byProgram.get(prog);
  if (!uploaded) {
    uploaded = {};
    byProgram.set(prog, uploaded);
  }
  return uploaded;
}

/** Element-wise, so a caller that mutates a shared array in place is still
 *  compared by value. A NaN anywhere compares unequal and re-uploads, which is
 *  the safe direction. */
export function sameValues(prev: Float32Array | undefined, next: ArrayLike<number>): boolean {
  if (prev === undefined || prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) if (prev[i] !== next[i]) return false;
  return true;
}

/**
 * `u_color`, skipped when the program already holds it. Every writer of
 * `u_color` must go through here — see `UploadedUniforms`.
 */
export function setColorUniform(
  ctx: DrawContext, prog: ShaderProgram,
  r: number, g: number, b: number, a: number,
): void {
  if (!prog.has('u_color')) return;
  const uploaded = uploadedFor(ctx, prog);
  const prev = uploaded.color;
  if (prev !== undefined && prev[0] === r && prev[1] === g && prev[2] === b && prev[3] === a) {
    return;
  }
  prog.set4f('u_color', r, g, b, a);
  uploaded.color = [r, g, b, a];
}

/** `u_alpha`, on the same terms as `setColorUniform`. */
export function setAlphaUniform(ctx: DrawContext, prog: ShaderProgram, alpha: number): void {
  if (!prog.has('u_alpha')) return;
  const uploaded = uploadedFor(ctx, prog);
  if (uploaded.alpha === alpha) return;
  prog.set1f('u_alpha', alpha);
  uploaded.alpha = alpha;
}

/** The screen→clip matrix: the frame's own, which depends only on its
 *  dimensions, unless the target being drawn covers some other window. */
export function projFor(ctx: DrawContext): GlMat3 {
  if (ctx.projection) return ctx.projection;
  let proj = FRAME_PROJ.get(ctx);
  if (!proj) {
    proj = mat3.toUniform(mat3.screenToClip(ctx.widthCss, ctx.heightCss));
    FRAME_PROJ.set(ctx, proj);
  }
  return proj;
}

/** Reused across draws: the transpose below rebuilt this every command. */
const COLOR_MATRIX_SCRATCH = new Float32Array(16);

export function setColorMatrixUniforms(
  ctx: DrawContext, prog: ShaderProgram,
  cm: Float32Array = ctx.state.colorMatrix, // row-major 4×5
): void {
  const uploaded = uploadedFor(ctx, prog);

  if (prog.has('u_colorMatrix')) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        COLOR_MATRIX_SCRATCH[col * 4 + row] = cm[row * 5 + col];
      }
    }
    if (!sameValues(uploaded.colorMatrix, COLOR_MATRIX_SCRATCH)) {
      prog.set('u_colorMatrix', 'mat4', COLOR_MATRIX_SCRATCH);
      uploaded.colorMatrix = Float32Array.from(COLOR_MATRIX_SCRATCH);
    }
  }

  if (prog.has('u_colorBias')) {
    const bias = [cm[4], cm[9], cm[14], cm[19]];
    if (!sameValues(uploaded.colorBias, bias)) {
      prog.set4f('u_colorBias', bias[0], bias[1], bias[2], bias[3]);
      uploaded.colorBias = Float32Array.from(bias);
    }
  }
}

/** A model translation at or past this many pixels is rebased before upload:
 *  a float32 there is coarser than 1/128 px, and at 2^24 than a whole one. */
export const REBASE_TRANSLATION_PX = 65536;

/**
 * The model a draw places its vertices by: the group's transform, moved to
 * the origin of the mesh being drawn when it has one. Composed in doubles,
 * so a far-off origin reaches the rebase below whole.
 */
export function drawModel(ctx: DrawContext): GlMat3 {
  const o = ctx.meshOrigin;
  return o ? mat3.translated(ctx.state.transform, o.x, o.y) : ctx.state.transform;
}

/** `draw()` with `ctx.meshOrigin` set to `origin`, for a mesh whose vertices
 *  are measured from it. */
export function atMeshOrigin<T>(
  ctx: DrawContext, origin: { readonly x: number; readonly y: number } | undefined, draw: () => T,
): T {
  const outer = ctx.meshOrigin;
  if (origin === outer) return draw();
  ctx.meshOrigin = origin;
  try {
    return draw();
  } finally {
    ctx.meshOrigin = outer;
  }
}

const MODEL_SCRATCH = new Float32Array(9);
const PROJ_SCRATCH = new Float32Array(9);

/**
 * `u_proj` and `u_model`, each skipped when the program already holds it.
 *
 * `model` is in doubles and the uniform is not: far from the origin at high
 * zoom its translation is millions of pixels, which a float32 holds to a
 * whole pixel at best. A program that declares `u_origin` computes
 * `u_model * (a_position - u_origin)`, so for a large translation this sends
 * the local point that lands on the screen's corner as `u_origin` and a model
 * whose translation is what is left over, a few pixels.
 */
export function setProjAndModel(
  ctx: DrawContext, prog: ShaderProgram,
  model: GlMat3 = drawModel(ctx),
  proj: GlMat3 = projFor(ctx),
): void {
  const uploaded = uploadedFor(ctx, prog);

  PROJ_SCRATCH.set(proj);
  if (!sameValues(uploaded.proj, PROJ_SCRATCH)) {
    prog.set('u_proj', 'mat3', PROJ_SCRATCH);
    uploaded.proj = Float32Array.from(PROJ_SCRATCH);
  }

  MODEL_SCRATCH.set(model);
  if (prog.has('u_origin')) {
    let ox = 0;
    let oy = 0;
    const tx = model[6], ty = model[7];
    if (Math.abs(tx) >= REBASE_TRANSLATION_PX || Math.abs(ty) >= REBASE_TRANSLATION_PX) {
      const a = model[0], b = model[1], c = model[3], d = model[4];
      const det = a * d - b * c;
      // Rounded first: the shader subtracts the float32 it was sent.
      const lx = Math.fround((c * ty - d * tx) / det);
      const ly = Math.fround((b * tx - a * ty) / det);
      if (Number.isFinite(lx) && Number.isFinite(ly)) {
        ox = lx;
        oy = ly;
        MODEL_SCRATCH[6] = a * ox + c * oy + tx;
        MODEL_SCRATCH[7] = b * ox + d * oy + ty;
      }
    }
    if (uploaded.originX !== ox || uploaded.originY !== oy) {
      prog.set2f('u_origin', ox, oy);
      uploaded.originX = ox;
      uploaded.originY = oy;
    }
  }

  if (!sameValues(uploaded.model, MODEL_SCRATCH)) {
    prog.set('u_model', 'mat3', MODEL_SCRATCH);
    uploaded.model = Float32Array.from(MODEL_SCRATCH);
  }
}

export function setSolidPaintUniforms(
  ctx: DrawContext, prog: ShaderProgram,
  color: string, opacity: number | undefined,
): void {
  const [r, g, b, a] = parseColor(color);
  setColorUniform(ctx, prog, r, g, b, a * (opacity ?? 1));
  setAlphaUniform(ctx, prog, ctx.state.alpha);
}
