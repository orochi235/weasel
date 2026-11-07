import { mat3 } from '@weasel-js/geom';
import { BATCH_TEXTURE_SLOTS, RAMP_SLOT } from '../shaders/batchFill';
import type { DrawContext } from './drawContext';
import { drawTriangles } from './drawTriangles';
import { setColorUniform, setProjAndModel } from './uniforms';
import { uploadBatchMatrices } from './batchMatrices';
import { clipTest } from './stencil';
import { HULL_POOL } from '../batchHull';
import type { StagedBatchState } from './batchRun';
import type { ShaderProgram } from '../shaders/ShaderProgram';

/** The rect batch transforms its own corners, so it draws at model identity. */
export const BATCH_MODEL = mat3.identity();

/** `u_fieldScale`, per slot: an atlas slot's `glyphFieldScale`. Slots that are
 *  not atlases keep whatever a previous flush wrote, which nothing reads. */
const FIELD_SCALES = new Float32Array(2 * BATCH_TEXTURE_SLOTS);

/** `u_hullPlanes`, filled per flush from the run's hull sets. */
const HULL_PLANES = new Int32Array(4 * HULL_POOL);

/**
 * Draw the staged run as one draw, under the state it was staged under.
 * Callers that are about to draw with a different program, or paint anything
 * that must land on top of the run, call this first.
 *
 * The stencil holds what the staged values cannot reconstruct, so
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
  const several = staged.matrices.length > 1;
  const hulls = staged.hulls !== undefined;
  const area = staged.areaGlyphs;
  const prog = (several || hulls || area) && ctx.batchVariants
    ? ctx.batchVariants.get(several, hulls, area)
    : ctx.batchFill;
  const { geometry, count } = batch.upload();
  setProjAndModel(ctx, prog, BATCH_MODEL);
  setColorUniform(ctx, prog, 1, 1, 1, 1);
  uploadBatchMatrices(ctx, prog, staged.matrices);
  prog.setTexture('u_samplers', ctx.whiteTexture, 0);
  const n = staged.textures.length;
  for (let i = 0; i < n; i++) {
    const entry = staged.textures[i];
    if (entry.kind === 'atlas') {
      prog.setTexture('u_samplers', ctx.textureCache.texture(entry.id), i + 1);
      FIELD_SCALES[2 * (i + 1)] = entry.fieldScale[0];
      FIELD_SCALES[2 * (i + 1) + 1] = entry.fieldScale[1];
      continue;
    }
    prog.setTexture('u_samplers', ctx.imageCache.texture(entry.image), i + 1);
    // Per flush, not at upload: the same bitmap can be drawn at both filters in
    // one frame. The device skips the write when the texture already carries
    // the value, which is most flushes.
    ctx.imageCache.setMagFilter(entry.image, entry.sampling === 'nearest' ? 'nearest' : 'linear');
    ctx.imageCache.setMinFilter(entry.image, entry.mips);
  }
  // Every slot named, so none keeps a texture an earlier flush bound and has
  // since freed.
  for (let i = n + 1; i < BATCH_TEXTURE_SLOTS; i++) {
    prog.setTexture('u_samplers', i === RAMP_SLOT && staged.ramps ? ctx.gradRamps.atlas() : null, i);
  }
  prog.set('u_fieldScale', 'vec2', FIELD_SCALES);
  if (hulls) uploadHulls(prog, staged);
  drawTriangles(ctx, prog, geometry, count, { stencil: clipTest(staged.clipDepth) });
  batch.reset();
  ctx.batchState = undefined;
}

function uploadHulls(prog: ShaderProgram, staged: StagedBatchState): void {
  for (const { set, start } of staged.hulls!) HULL_PLANES.set(set.planes, 4 * start);
  prog.set('u_hullPlanes', 'ivec4', HULL_PLANES, 0, 4 * staged.hullPlanes);
}
