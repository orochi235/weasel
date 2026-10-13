import type { ColorSpace, GradStop } from '@weasel-js/paint';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import { colorFolding, foldColor, isIdentityColorMatrix } from './foldColor';
import type { Mesh } from '@weasel-js/geom/tessellate';
import { resolveColor } from '@weasel-js/paint';
import { BATCH_TEXTURE_SLOTS } from '../shaders/batchFill';
import type { DrawContext } from './drawContext';
import { sameValues } from './uniforms';
import { runClipDepth, retryUncut, flushForOwnDraw } from './clip';
import { flushBatch } from './flushBatch';
import { type BatchPaint, rampVertices } from './gradient';

/**
 * The group state a staged run was built under.
 *
 * A run outlives the group it started in, so the state live when the flush
 * happens is not the state the rects belong to — the flush draws with these
 * values instead. Transform is absent because it rides the vertices; `alpha`
 * is 1 whenever it rode them too.
 */
export interface StagedBatchState {
  alpha: number;
  colorMatrix: Float32Array;
  clipDepth: number;
  /**
   * The SDF threshold shift `u_synthBold` draws this run under. A uniform
   * rather than a vertex attribute, and so a thing that breaks a run: a
   * per-vertex float only glyphs read would widen the buffer write for every
   * rect and quad beside them. The break falls wherever faked-bold text meets
   * text that is not, which is a fallback path: a registered bold face never
   * sets this at all.
   */
  synthBold: number;
  /** Whether group alpha folded into the vertex colors. */
  foldsAlpha: boolean;
  /**
   * The textures this run samples, in the order they joined. A quad's vertices
   * carry `index + 1`, because slot 0 is the white texel every solid samples.
   *
   * Two kinds, because two caches own them: an image quad names an
   * `ImageBitmap` that `GLImageCache` keys by identity, a glyph names the
   * string id of a font atlas in `GLTextureCache`. They share the slot list so
   * a caption and the thumbnail above it share a draw.
   *
   * A bitmap's `sampling` is per entry and set per flush rather than at upload:
   * MAG_FILTER is state on the texture object, so the same bitmap drawn at both
   * filters in one frame needs two flushes, not two slots. An atlas carries no
   * sampling because `GLTextureCache` owns its filtering — and must keep
   * owning it: filtering a distance field destroys it, so a font atlas is
   * never mipmapped and never joins a shared image atlas.
   */
  textures: BatchTexture[];
}

/** One entry in a run's slot list. */
type BatchTexture =
  | { kind: 'bitmap'; image: ImageBitmap; sampling: 'linear' | 'nearest' }
  | { kind: 'atlas'; id: string; fieldScale: readonly [number, number] }
  | { kind: 'ramps' };


/**
 * Whether the live group state would draw the staged run identically.
 *
 * By value, not by reference: a group carrying an identity color matrix still
 * goes through `compose4x5`, which allocates a new array holding equal numbers.
 * Twenty float compares are nothing against the draw call they save.
 */
function stagedStateIsLive(
  ctx: DrawContext, staged: StagedBatchState,
  image?: ImageBitmap, sampling?: 'linear' | 'nearest',
  synthBold = 0,
  folds = false,
): boolean {
  if (staged.clipDepth !== (ctx.clipStack.length === 0 ? ctx.clipDepth : runClipDepth(ctx))) return false;
  // Solids and image quads ask with 0, which is what a run of them carries, so
  // this only ever breaks between two kinds of glyph.
  if (staged.synthBold !== synthBold) return false;
  if (!staged.foldsAlpha && staged.alpha !== ctx.state.alpha) return false;
  if (image !== undefined && slotForBitmap(staged, image, sampling!) < 0) return false;
  const colorMatrix = ctx.state.colorMatrix;
  if (staged.colorMatrix === colorMatrix || sameValues(staged.colorMatrix, colorMatrix)) return true;
  // A run drawn under identity takes any solid or glyph: `foldColor` maps its
  // color before it is staged.
  return folds && staged.foldsAlpha;
}

/**
 * The slot `image` would sample from in this run, or -1 if it cannot join.
 *
 * A bitmap already in the run reuses its slot — but only at the filter it went
 * in under, since MAG_FILTER belongs to the texture object and one draw cannot
 * have it both ways. Otherwise it takes the next free slot, and a run with none
 * left is a run this quad has to break.
 */
function slotForBitmap(
  staged: StagedBatchState, image: ImageBitmap, sampling: 'linear' | 'nearest',
): number {
  for (let i = 0; i < staged.textures.length; i++) {
    const entry = staged.textures[i];
    if (entry.kind !== 'bitmap' || entry.image !== image) continue;
    return entry.sampling === sampling ? i + 1 : -1;
  }
  return nextFreeSlot(staged);
}

/** The same for the ramp atlas, of which there is one — so every gradient in a
 *  run shares the slot, however many distinct ramps they are. */
function slotForRamps(staged: StagedBatchState): number {
  for (let i = 0; i < staged.textures.length; i++) {
    if (staged.textures[i].kind === 'ramps') return i + 1;
  }
  return nextFreeSlot(staged);
}

/** The same for a font atlas, which has no filter to disagree about. */
function slotForAtlas(staged: StagedBatchState, id: string): number {
  for (let i = 0; i < staged.textures.length; i++) {
    const entry = staged.textures[i];
    if (entry.kind === 'atlas' && entry.id === id) return i + 1;
  }
  return nextFreeSlot(staged);
}

/** The slot a texture new to this run would take, or -1 if it is full. */
function nextFreeSlot(staged: StagedBatchState): number {
  return staged.textures.length + 1 < BATCH_TEXTURE_SLOTS ? staged.textures.length + 1 : -1;
}

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
function canBatchMesh(ctx: DrawContext, mesh: Mesh): boolean {
  if (mesh.requiresStencil) return false;
  const cap = ctx.drawBatch.length > 0 ? meshBatching.maxVerticesInRun : meshBatching.maxVertices;
  return (mesh.vertices.length >> 1) <= cap;
}

/**
 * Open or continue a run for `vertices` more, flushing first if the run would
 * overflow or if the live group state no longer matches what it was staged
 * under. Returns the staged state, which the caller reads to resolve alpha.
 *
 * Fill opacity folds into the vertex alpha, exactly as `u_color` carried it
 * when each shape was its own draw. Group alpha and the group's color matrix
 * fold in too, in a run drawn under identity (`foldColor`). A solid that joins
 * a run a textured quad opened under a real matrix leaves both to the shader,
 * and there a differing alpha breaks the run.
 */
export function stageSolid(ctx: DrawContext, vertices: number): StagedBatchState {
  if (ctx.batchState !== undefined
      && !stagedStateIsLive(ctx, ctx.batchState, undefined, undefined, 0, colorFolding.enabled)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(vertices)) flushBatch(ctx);
  return openRun(ctx, colorFolding.enabled);
}

/**
 * The staged state, opening a run if none is. `folds` says the caller's color
 * is known here, so its run draws under identity whatever the group's matrix;
 * a textured quad's is not, and its run draws under the live one.
 */
function openRun(ctx: DrawContext, folds = false): StagedBatchState {
  if (ctx.batchState === undefined) {
    const colorMatrix = folds ? IDENTITY_COLOR_MATRIX : ctx.state.colorMatrix;
    const foldsAlpha = isIdentityColorMatrix(colorMatrix);
    ctx.batchState = {
      alpha: foldsAlpha ? 1 : ctx.state.alpha,
      colorMatrix,
      clipDepth: runClipDepth(ctx),
      synthBold: 0,
      foldsAlpha,
      textures: [],
    };
  }
  return ctx.batchState;
}

/**
 * Open or continue a run for one more image quad, flushing first if the run
 * would overflow or cannot give this bitmap a slot. A run adopts a bitmap it
 * has not seen rather than breaking, which is what lets a ground rect and the
 * atlas quad over it share a draw. Returns the staged state and the slot the
 * quad's vertices must carry.
 */
export function stageImage(
  ctx: DrawContext, image: ImageBitmap, sampling: 'linear' | 'nearest',
): { staged: StagedBatchState; slot: number } {
  if (ctx.batchState !== undefined
      && !stagedStateIsLive(ctx, ctx.batchState, image, sampling)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx);
  let slot = slotForBitmap(staged, image, sampling);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'bitmap', image, sampling });
    slot = staged.textures.length;
  }
  return { staged, slot };
}

/**
 * Open or continue a run for a glyph off the font atlas `atlasId`, flushing
 * first if the run would overflow or has no slot left for it. Every glyph a
 * face contributes to a frame shares one texture, so a paragraph is one run,
 * and a second face costs one more slot rather than a flush per word.
 */
export function stageGlyphs(
  ctx: DrawContext, atlasId: string, fieldScale: readonly [number, number], synthBold: number,
): { staged: StagedBatchState; slot: number } {
  if (ctx.batchState !== undefined
      && (!stagedStateIsLive(ctx, ctx.batchState, undefined, undefined, synthBold, colorFolding.enabled)
          || slotForAtlas(ctx.batchState, atlasId) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx, colorFolding.enabled);
  // An empty run adopts the threshold; one that already has vertices agreed to
  // it above, since a mismatch flushed.
  staged.synthBold = synthBold;
  let slot = slotForAtlas(staged, atlasId);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'atlas', id: atlasId, fieldScale });
    slot = staged.textures.length;
  }
  return { staged, slot };
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
): { staged: StagedBatchState; slot: number; rowV: number } {
  if (ctx.gradRamps.wouldReshape(stops, space)) flushBatch(ctx);
  if (ctx.batchState !== undefined
      && (!stagedStateIsLive(ctx, ctx.batchState) || slotForRamps(ctx.batchState) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(vertices)) flushBatch(ctx);
  const staged = openRun(ctx);
  let slot = slotForRamps(staged);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'ramps' });
    slot = staged.textures.length;
  }
  return { staged, slot, rowV: ctx.gradRamps.rowV(ctx.gradRamps.upload(stops, space)) };
}

/** Alpha a batched paint's vertices carry: its own opacity, and the group's
 *  under an identity color matrix. */
function stagedAlpha(
  ctx: DrawContext, staged: StagedBatchState, opacity: number | undefined,
): number {
  return (opacity ?? 1) * (staged.foldsAlpha ? ctx.state.alpha : 1);
}

/** Straight-alpha rgba for a solid paint under the staged state. */
function stagedColor(
  ctx: DrawContext, staged: StagedBatchState,
  paint: { color: string; opacity?: number },
): [number, number, number, number] {
  const [r, g, b, a] = resolveColor(paint.color);
  return foldColor(ctx, staged, r, g, b, a * (paint.opacity ?? 1));
}

export function pushRect(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  fill: { color: string; opacity?: number },
): void {
  const staged = stageSolid(ctx, 4);
  const [r, g, b, a] = stagedColor(ctx, staged, fill);
  if (!ctx.drawBatch.pushRect(
    rect.x, rect.y, rect.width, rect.height, ctx.state.transform, r, g, b, a,
  )) retryUncut(ctx, rect, fill, pushRect);
}

function pushMesh(
  ctx: DrawContext,
  mesh: Mesh,
  paint: { color: string; opacity?: number },
): void {
  const staged = stageSolid(ctx, mesh.vertices.length >> 1);
  const [r, g, b, a] = stagedColor(ctx, staged, paint);
  if (!ctx.drawBatch.pushMesh(mesh, ctx.state.transform, r, g, b, a)) {
    retryUncut(ctx, mesh, paint, pushMesh);
  }
}

export function pushRampRect(
  ctx: DrawContext,
  rect: { x: number; y: number; width: number; height: number },
  paint: Extract<BatchPaint, { kind: 'ramp' }>,
): void {
  const { staged, slot, rowV } = stageRamps(ctx, paint.stops, paint.space, 4);
  const { uv, post } = rampVertices(paint, rowV);
  // White vertices, so the ramp texel passes through as its own color and the
  // alpha channel carries what `u_opacity` and `u_alpha` used to.
  if (!ctx.drawBatch.pushGradientRect(
    rect.x, rect.y, rect.width, rect.height, ctx.state.transform,
    uv, post, slot, paint.mode, 1, 1, 1, stagedAlpha(ctx, staged, paint.opacity),
  )) retryUncut(ctx, rect, paint, pushRampRect);
}

function pushRampMesh(
  ctx: DrawContext, mesh: Mesh, paint: Extract<BatchPaint, { kind: 'ramp' }>,
): void {
  const { staged, slot, rowV } = stageRamps(ctx, paint.stops, paint.space, mesh.vertices.length >> 1);
  const { uv, post } = rampVertices(paint, rowV);
  if (!ctx.drawBatch.pushGradientMesh(
    mesh, ctx.state.transform,
    uv, post, slot, paint.mode, 1, 1, 1, stagedAlpha(ctx, staged, paint.opacity),
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
 * The page takes a slot as a font atlas does, and the run is an image quad's:
 * its texel is a color, which cannot fold through the group's color matrix
 * before it is staged.
 */
export function stageColorGlyphs(
  ctx: DrawContext, atlasId: string,
): { staged: StagedBatchState; slot: number } {
  if (ctx.batchState !== undefined
      && (!stagedStateIsLive(ctx, ctx.batchState) || slotForAtlas(ctx.batchState, atlasId) < 0)) {
    flushBatch(ctx);
  }
  if (ctx.drawBatch.wouldOverflow(4)) flushBatch(ctx);
  const staged = openRun(ctx);
  let slot = slotForAtlas(staged, atlasId);
  if (slot > staged.textures.length) {
    staged.textures.push({ kind: 'atlas', id: atlasId, fieldScale: NO_FIELD });
    slot = staged.textures.length;
  }
  return { staged, slot };
}
