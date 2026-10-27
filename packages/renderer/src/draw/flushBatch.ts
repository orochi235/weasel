import { mat3 } from '@weasel-js/geom';
import { BATCH_TEXTURE_SLOTS, RAMP_SLOT } from '../shaders/batchFill';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { setColorUniform, setProjAndModel } from './uniforms';
import { uploadBatchMatrices } from './batchMatrices';
import { applyClipTest } from './stencil';
import { HULL_POOL } from '../batchHull';
import type { StagedBatchState } from './batchRun';
import type { ShaderProgram } from '../shaders/ShaderProgram';

/** The rect batch transforms its own corners, so it draws at model identity. */
export const BATCH_MODEL = mat3.identity();

/** `u_samplers[i] = i`, uploaded whole per flush. Built once: the mapping from
 *  slot to texture unit is the identity and never varies. */
const SAMPLER_UNITS = new Int32Array(
  Array.from({ length: BATCH_TEXTURE_SLOTS }, (_, i) => i),
);

/** `u_fieldScale`, per slot: an atlas slot's `glyphFieldScale`. Slots that are
 *  not atlases keep whatever a previous flush wrote, which nothing reads. */
const FIELD_SCALES = new Float32Array(2 * BATCH_TEXTURE_SLOTS);

/** `u_hullPlanes`, filled per flush from the run's hull sets. */
const HULL_PLANES = new Int32Array(4 * HULL_POOL);

/**
 * Draw the staged run as one `drawElements`, under the state it was staged
 * under. Callers that are about to bind a different program, or paint anything
 * that must land on top of the run, call this first.
 *
 * The stencil is real GL state that the staged values cannot reconstruct, so
 * `pushClip` flushes *before* writing a bit, and `popClip` before clearing one
 * a staged run tests.
 *
 * `u_color` stays white because the program multiplies it by the per-vertex
 * color, and `u_model` stays identity because the corners arrive already
 * transformed.
 */
export function flushBatch(ctx: DrawContext): void {
  const batch = ctx.drawBatch;
  const staged = ctx.batchState;
  if (batch.length === 0 || staged === undefined) {
    // An empty run's state still names a clip depth, and an item refused by
    // the CPU cut is about to be staged again under a different one.
    ctx.batchState = undefined;
    return;
  }
  const gl = ctx.gl;
  const several = staged.matrices.length > 1;
  const hulls = staged.hulls !== undefined;
  const prog = (several || hulls) && ctx.batchVariants
    ? ctx.batchVariants.get(several, hulls)
    : ctx.batchFill;
  gl.useProgram(prog.handle);
  const indexCount = batch.uploadAndBind();
  setProjAndModel(ctx, prog, BATCH_MODEL);
  setColorUniform(ctx, prog, 1, 1, 1, 1);
  uploadBatchMatrices(ctx, prog, staged.matrices);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ctx.whiteTexture);
  for (let i = 0; i < staged.textures.length; i++) {
    const entry = staged.textures[i];
    if (entry.kind === 'atlas') {
      ctx.textureCache.bind(entry.id, i + 1);
      FIELD_SCALES[2 * (i + 1)] = entry.fieldScale[0];
      FIELD_SCALES[2 * (i + 1) + 1] = entry.fieldScale[1];
      continue;
    }
    ctx.imageCache.bind(entry.image, i + 1);
    // Per flush, not at upload: the same bitmap can be drawn at both filters in
    // one frame. The cache skips the write when the texture already carries the
    // value, which is most flushes.
    ctx.imageCache.setMagFilter(
      entry.image,
      entry.sampling === 'nearest' ? gl.NEAREST : gl.LINEAR,
    );
  }
  if (staged.ramps) ctx.gradRamps.bind(RAMP_SLOT);
  gl.uniform1iv(prog.uniform('u_samplers')!, SAMPLER_UNITS);
  gl.uniform2fv(prog.uniform('u_fieldScale')!, FIELD_SCALES);
  if (hulls) uploadHulls(gl, prog, staged);
  applyClipTest(ctx, staged.clipDepth);
  drawTriangles(ctx, indexCount, ctx.gl.UNSIGNED_INT);
  // Everything else in the renderer binds its texture to unit 0 and some of it
  // does so without an `activeTexture` of its own, so leaving a high unit selected
  // sends the next such bind to a unit nothing samples.
  gl.activeTexture(gl.TEXTURE0);
  // Not redundant: `drawShader` binds no VAO and points attributes at whatever
  // is current, so a slot left bound here comes back corrupted a ring later.
  gl.bindVertexArray(null);
  batch.reset();
  ctx.batchState = undefined;
}

function uploadHulls(gl: WebGL2RenderingContext, prog: ShaderProgram, staged: StagedBatchState): void {
  for (const { set, start } of staged.hulls!) HULL_PLANES.set(set.planes, 4 * start);
  gl.uniform4iv(prog.uniform('u_hullPlanes')!, HULL_PLANES, 0, 4 * staged.hullPlanes);
}
