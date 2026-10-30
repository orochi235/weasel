import type { ColorSpace, GradStop } from '@weasel-js/paint';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import { foldColor, foldsColor, textureTint, type Tint } from './foldColor';
import type { Mesh } from '@weasel-js/geom/tessellate';
import { resolveColor } from '@weasel-js/paint';
import { PAINT_MODE_PLAIN, WHITE_SLOT, packSlot, withMatrix } from '../shaders/batchFill';
import type { DrawContext } from './drawContext';
import { retryUncut, flushForOwnDraw } from './clip';
import { flushBatch } from './flushBatch';
import {
  openRun, runTakes, slotForAtlas, slotForBitmap, slotForRamps, takeHulls, takeMatrix,
} from './batchRun';
import { type BatchPaint, rampVertices } from './gradient';

/**
 * Vertices above which a mesh keeps its own draw, by whether a run is open.
 *
 * Batching trades a draw call for copying and re-uploading the mesh every
 * frame, where a mesh already in the persistent cache costs nothing per frame
 * beyond the draw. Drawn alone with a run open, a mesh also closes that run and
 * switches program twice, so it breaks even far later there. Both values sit
 * below what `tests/perf/mesh-batch.spec.ts` measured: being wrong on the
 * open-run side costs ten times more.
 */
const MAX_BATCHED_MESH_VERTICES = 96;

const MAX_BATCHED_MESH_VERTICES_IN_RUN = 1024;

/** The caps {@link canBatchMesh} reads. Mutable only so `mesh-batch.spec.ts`
 *  can time both sides of them in one page; the barrel does not export it. */
export const meshBatching = {
  maxVertices: MAX_BATCHED_MESH_VERTICES,
  maxVerticesInRun: MAX_BATCHED_MESH_VERTICES_IN_RUN,
};

/** Whether a mesh can join a run. Stencil fills need their own two-pass dance,
 *  and a mesh past the cap is cheaper as its own draw. */
export function canBatchMesh(ctx: DrawContext, mesh: Mesh): boolean {
  if (mesh.requiresStencil) return false;
  const cap = ctx.drawBatch.length > 0 ? meshBatching.maxVerticesInRun : meshBatching.maxVertices;
  return (mesh.vertices.length >> 1) <= cap;
}

/**
 * Open or continue a run for `vertices` more of solid geometry, flushing first
 * if the run would overflow, was staged at another clip depth, or has no room
 * for the matrix. Returns what the vertices carry in `a_texSlot`.
 *
 * Fill opacity folds into the vertex alpha, and so do the group's alpha and
 * color matrix (`foldColor`), which is why the matrix a solid asks its run for
 * is identity: a group's matrix cannot break a run of them.
 */
export function stageSolid(ctx: DrawContext, vertices: number): number {
  const folds = foldsColor(ctx);
  return stagePlain(
    ctx, vertices, folds ? IDENTITY_COLOR_MATRIX : ctx.state.colorMatrix, folds ? 1 : ctx.state.alpha,
  );
}

/** {@link stageSolid} for vertices the run draws under `colorMatrix` and `alpha`. */
export function stagePlain(
  ctx: DrawContext, vertices: number, colorMatrix: Float32Array, alpha: number,
): number {
  const open = ctx.batchState;
  if (open !== undefined && !runTakes(ctx, open, colorMatrix, alpha)) flushBatch(ctx);
  if (ctx.drawBatch.wouldOverflow(vertices)) flushBatch(ctx);
  const staged = openRun(ctx);
  const matrix = takeMatrix(staged, colorMatrix, alpha);
  return packSlot(takeHulls(ctx, staged, withMatrix(WHITE_SLOT, matrix)), PAINT_MODE_PLAIN);
}

/**
 * What a textured vertex is staged under: the matrix and alpha its run draws
 * it by, the tint its vertices carry, and, once a stage call has filled it in,
 * the slot they name.
 */
interface Textured {
  colorMatrix: Float32Array;
  alpha: number;
  /** The fourth channel carries group alpha wherever the entry's does not. */
  tint: Tint;
  /** Texture slot and matrix index together; `packSlot` adds the paint mode. */
  slot: number;
}

const UNTINTED: Tint = [1, 1, 1, 1];

/**
 * A texel's color is not known until it is sampled, so the group's matrix
 * reaches it one of two ways. One that only scales channels down becomes a
 * tint on the vertices, in a run entry at identity. Any other stays a matrix
 * for the shader, as an entry of its own.
 *
 * `alphaInEntry` says where group alpha goes in that second case: into the
 * entry for a gradient, whose `a_post` may be its atlas row, and into the
 * tint's fourth channel for a quad, which multiplies its `a_post` by it.
 */
function texturedUnder(ctx: DrawContext, alphaInEntry: boolean): Textured {
  const tint = textureTint(ctx);
  if (tint !== null) return { colorMatrix: IDENTITY_COLOR_MATRIX, alpha: 1, tint, slot: 0 };
  const colorMatrix = ctx.state.colorMatrix;
  const alpha = ctx.state.alpha;
  return alphaInEntry
    ? { colorMatrix, alpha, tint: UNTINTED, slot: 0 }
    : { colorMatrix, alpha: 1, tint: [1, 1, 1, alpha], slot: 0 };
}

/**
 * Open or continue a run for one more image quad, flushing first if the run
 * would overflow or cannot give this bitmap a slot. A run adopts a bitmap it
 * has not seen rather than breaking, which is what lets a ground rect and the
 * atlas quad over it share a draw. Returns the slot the quad's vertices carry
 * and their tint.
 */
export function stageImage(
  ctx: DrawContext, image: ImageBitmap, sampling: 'linear' | 'nearest',
): { slot: number; tint: Tint } {
  const under = texturedUnder(ctx, false);
  const open = ctx.batchState;
  if (open !== undefined
      && (!runTakes(ctx, open, under.colorMatrix, under.alpha)
          || slotForBitmap(open, image, sampling) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx);
  let slot = slotForBitmap(staged, image, sampling);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'bitmap', image, sampling });
    slot = staged.textures.length;
  }
  under.slot = takeHulls(ctx, staged, withMatrix(slot, takeMatrix(staged, under.colorMatrix, under.alpha)));
  return under;
}

/**
 * Open or continue a run for a glyph off the font atlas `atlasId`, flushing
 * first if the run would overflow or has no slot left for it. Every glyph a
 * face contributes to a frame shares one texture, so a paragraph is one run,
 * and a second face costs one more slot rather than a flush per word. Returns
 * the slot the glyph's vertices carry; its color is mapped as a solid's is.
 */
export function stageGlyphs(
  ctx: DrawContext, atlasId: string, fieldScale: readonly [number, number], area: boolean,
): number {
  const folds = foldsColor(ctx);
  const colorMatrix = folds ? IDENTITY_COLOR_MATRIX : ctx.state.colorMatrix;
  const alpha = folds ? 1 : ctx.state.alpha;
  const open = ctx.batchState;
  if (open !== undefined
      && (!runTakes(ctx, open, colorMatrix, alpha) || slotForAtlas(open, atlasId) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx);
  let slot = slotForAtlas(staged, atlasId);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'atlas', id: atlasId, fieldScale });
    slot = staged.textures.length;
  }
  if (area) staged.areaGlyphs = true;
  return takeHulls(ctx, staged, withMatrix(slot, takeMatrix(staged, colorMatrix, alpha)));
}

/**
 * Open or continue a run for geometry filled from the ramp atlas, flushing
 * first if the run would overflow, has no slot left, or if baking `stops` would
 * move the rows already staged.
 *
 * **That last one is the trap.** A staged vertex names its ramp by where the
 * row sits, so growing the atlas — which changes every row's `v` — or recycling
 * a row repaints geometry already staged with somebody else's gradient. Both
 * are irreversible once done, so the question is asked before the bake, not
 * after.
 */
function stageRamps(
  ctx: DrawContext, stops: GradStop[], space: ColorSpace, vertices: number,
): { slot: number; tint: Tint; rowV: number } {
  if (ctx.gradRamps.wouldReshape(stops, space)) flushBatch(ctx);
  const under = texturedUnder(ctx, true);
  const open = ctx.batchState;
  if (open !== undefined
      && (!runTakes(ctx, open, under.colorMatrix, under.alpha) || slotForRamps(open) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(vertices)) flushBatch(ctx);
  const staged = openRun(ctx);
  const slot = slotForRamps(staged);
  staged.ramps = true;
  return {
    slot: takeHulls(ctx, staged, withMatrix(slot, takeMatrix(staged, under.colorMatrix, under.alpha))),
    tint: under.tint,
    rowV: ctx.gradRamps.rowV(ctx.gradRamps.upload(stops, space)),
  };
}

/** Straight-alpha rgba for a solid paint, its `opacity` taken into the alpha. */
export function solidColor(paint: { color: string; opacity?: number }): [number, number, number, number] {
  const [r, g, b, a] = resolveColor(paint.color);
  return [r, g, b, a * (paint.opacity ?? 1)];
}

/** Straight-alpha rgba for a solid paint under the live group state. */
function stagedColor(
  ctx: DrawContext, paint: { color: string; opacity?: number },
): [number, number, number, number] {
  const [r, g, b, a] = solidColor(paint);
  return foldColor(ctx, r, g, b, a);
}

export function pushRect(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  fill: { color: string; opacity?: number },
): void {
  const slot = stageSolid(ctx, 4);
  const [r, g, b, a] = stagedColor(ctx, fill);
  if (!ctx.drawBatch.pushRect(
    rect.x, rect.y, rect.width, rect.height, ctx.state.transform, r, g, b, a, slot,
  )) retryUncut(ctx, rect, fill, pushRect);
}

function pushMesh(
  ctx: DrawContext,
  mesh: Mesh,
  paint: { color: string; opacity?: number },
): void {
  const slot = stageSolid(ctx, mesh.vertices.length >> 1);
  const [r, g, b, a] = stagedColor(ctx, paint);
  if (!ctx.drawBatch.pushMesh(mesh, ctx.state.transform, r, g, b, a, slot)) {
    retryUncut(ctx, mesh, paint, pushMesh);
  }
}

export function pushRampRect(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  paint: Extract<BatchPaint, { kind: 'ramp' }>,
): void {
  const { slot, tint, rowV } = stageRamps(ctx, paint.stops, paint.space, 4);
  const { uv, post } = rampVertices(paint, rowV);
  // White vertices but for the tint, so the ramp texel passes through as its
  // own color, and the alpha channel carries what `u_opacity` used to.
  if (!ctx.drawBatch.pushGradientRect(
    rect.x, rect.y, rect.width, rect.height, ctx.state.transform,
    uv, post, slot, paint.mode, tint[0], tint[1], tint[2], (paint.opacity ?? 1) * tint[3],
  )) retryUncut(ctx, rect, paint, pushRampRect);
}

function pushRampMesh(
  ctx: DrawContext, mesh: Mesh, paint: Extract<BatchPaint, { kind: 'ramp' }>,
): void {
  const { slot, tint, rowV } = stageRamps(ctx, paint.stops, paint.space, mesh.vertices.length >> 1);
  const { uv, post } = rampVertices(paint, rowV);
  if (!ctx.drawBatch.pushGradientMesh(
    mesh, ctx.state.transform,
    uv, post, slot, paint.mode, tint[0], tint[1], tint[2], (paint.opacity ?? 1) * tint[3],
  )) retryUncut(ctx, mesh, paint, pushRampMesh);
}

/**
 * Stage `mesh` into the run, or drain the run so the caller can draw it itself.
 *
 * `true` means the mesh is in the batch and the caller is done. `false` comes
 * back only *after* a flush, so an emitter cannot earn permission to draw for
 * itself without also draining the batch. `paint` is `undefined` when it is one
 * no run can express — see `batchPaint`.
 */
export function tryStageFill(
  ctx: DrawContext,
  mesh: Mesh,
  paint: BatchPaint | undefined,
): boolean {
  if (paint !== undefined && canBatchMesh(ctx, mesh)) {
    if (paint.kind === 'ramp') pushRampMesh(ctx, mesh, paint);
    else pushMesh(ctx, mesh, paint);
    return true;
  }
  flushForOwnDraw(ctx);
  return false;
}

/** A color page has no distance field, so nothing reads its slot's scale. */
const NO_FIELD = [0, 0] as const;

/**
 * Open or continue a run for a quad off the page of color glyphs `atlasId`.
 * The page takes a slot as a font atlas does, and the quad is staged as an
 * image's is: its texel is a color, which the group's matrix reaches as a tint
 * or in the shader.
 */
export function stageColorGlyphs(
  ctx: DrawContext, atlasId: string,
): { slot: number; tint: Tint } {
  const under = texturedUnder(ctx, false);
  const open = ctx.batchState;
  if (open !== undefined
      && (!runTakes(ctx, open, under.colorMatrix, under.alpha)
          || slotForAtlas(open, atlasId) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx);
  let slot = slotForAtlas(staged, atlasId);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'atlas', id: atlasId, fieldScale: NO_FIELD });
    slot = staged.textures.length;
  }
  under.slot = takeHulls(ctx, staged, withMatrix(slot, takeMatrix(staged, under.colorMatrix, under.alpha)));
  return under;
}
