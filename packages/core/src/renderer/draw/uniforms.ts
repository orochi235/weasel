import type { ShaderProgram } from '../shaders/ShaderProgram';
import { mat3, type GlMat3 } from '../math/mat3';
import { resolveColor } from '../math/color';
import type { DrawContext } from './drawContext';

/**
 * Uniform values a program already holds this frame.
 *
 * GL keeps uniform state per program object, so re-sending a value the program
 * already has buys nothing. `u_proj` is constant for the whole frame and
 * `u_colorMatrix` is the identity in every scene that does not use one, yet
 * both were re-sent for every command: at a few thousand commands the two were
 * most of the frame.
 *
 * Keyed on the `DrawContext`, which `WeaselRenderer.render` builds fresh per
 * frame, so the cache cannot outlive a frame and go stale against GL state
 * that changed between them.
 *
 * **Only for uniforms this module is the sole writer of.** `u_color` and
 * `u_alpha` qualify because every write of them goes through `setColorUniform`
 * / `setAlphaUniform` — keep it that way. A `gl.uniform4f(… 'u_color' …)` added
 * anywhere else leaves the cache believing a value the program no longer has,
 * and the wrong color is drawn until something else moves it.
 */
interface UploadedUniforms {
  proj?: Float32Array;
  model?: Float32Array;
  colorMatrix?: Float32Array;
  colorBias?: Float32Array;
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
 * `u_color`, skipped when the program already holds it.
 *
 * Every writer of `u_color` goes through here — see `UploadedUniforms`. The
 * solid batch is what makes it worth caching: it holds the uniform at white
 * forever and flushed once per state change, so a mixed document re-sent the
 * same white a few hundred times a frame.
 */
export function setColorUniform(
  ctx: DrawContext, prog: ShaderProgram,
  r: number, g: number, b: number, a: number,
): void {
  const loc = prog.uniform('u_color');
  if (loc === undefined) return;
  const uploaded = uploadedFor(ctx, prog);
  const prev = uploaded.color;
  if (prev !== undefined && prev[0] === r && prev[1] === g && prev[2] === b && prev[3] === a) {
    return;
  }
  ctx.gl.uniform4f(loc, r, g, b, a);
  uploaded.color = [r, g, b, a];
}

/** `u_alpha`, on the same terms as `setColorUniform`. */
export function setAlphaUniform(ctx: DrawContext, prog: ShaderProgram, alpha: number): void {
  const loc = prog.uniform('u_alpha');
  if (loc === undefined) return;
  const uploaded = uploadedFor(ctx, prog);
  if (uploaded.alpha === alpha) return;
  ctx.gl.uniform1f(loc, alpha);
  uploaded.alpha = alpha;
}

/** The screen→clip matrix depends only on the frame's dimensions. */
function projFor(ctx: DrawContext): GlMat3 {
  let proj = FRAME_PROJ.get(ctx);
  if (!proj) {
    proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
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
  const gl = ctx.gl;
  const uploaded = uploadedFor(ctx, prog);

  const mLoc = prog.uniform('u_colorMatrix');
  if (mLoc !== undefined) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        COLOR_MATRIX_SCRATCH[col * 4 + row] = cm[row * 5 + col];
      }
    }
    if (!sameValues(uploaded.colorMatrix, COLOR_MATRIX_SCRATCH)) {
      gl.uniformMatrix4fv(mLoc, false, COLOR_MATRIX_SCRATCH);
      uploaded.colorMatrix = Float32Array.from(COLOR_MATRIX_SCRATCH);
    }
  }

  const bLoc = prog.uniform('u_colorBias');
  if (bLoc !== undefined) {
    const bias = [cm[4], cm[9], cm[14], cm[19]];
    if (!sameValues(uploaded.colorBias, bias)) {
      gl.uniform4f(bLoc, bias[0], bias[1], bias[2], bias[3]);
      uploaded.colorBias = Float32Array.from(bias);
    }
  }
}

export function setProjAndModel(
  ctx: DrawContext, prog: ShaderProgram,
  model: GlMat3 = ctx.state.transform,
  proj: GlMat3 = projFor(ctx),
): void {
  const gl = ctx.gl;
  const uploaded = uploadedFor(ctx, prog);

  if (!sameValues(uploaded.proj, proj)) {
    gl.uniformMatrix3fv(prog.uniform('u_proj')!, false, proj);
    uploaded.proj = Float32Array.from(proj);
  }

  if (!sameValues(uploaded.model, model)) {
    gl.uniformMatrix3fv(prog.uniform('u_model')!, false, model);
    uploaded.model = Float32Array.from(model);
  }
}

export function setSolidPaintUniforms(
  ctx: DrawContext, prog: ShaderProgram,
  color: string, opacity: number | undefined,
): void {
  const [r, g, b, a] = resolveColor(color);
  setColorUniform(ctx, prog, r, g, b, a * (opacity ?? 1));
  setAlphaUniform(ctx, prog, ctx.state.alpha);
}
