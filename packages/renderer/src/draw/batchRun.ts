import { BATCH_TEXTURE_SLOTS } from '../shaders/batchFill';
import { type BatchMatrix, matrixIndex } from './batchMatrices';
import { runClipDepth } from './clip';
import type { DrawContext } from './drawContext';

/**
 * What a staged run draws under, and what it samples.
 *
 * A run outlives the group it started in, so the state live when the flush
 * happens is not the state its vertices belong to — the flush draws with these
 * values instead. Transform is absent because it rides the vertices.
 */
export interface StagedBatchState {
  clipDepth: number;
  /**
   * The color matrices this run draws under, in the order they joined; a
   * vertex carries the index of its own. A solid or a glyph is mapped before
   * it is staged and names an identity entry, so only a texel under a matrix
   * no vertex tint expresses adds one.
   */
  matrices: BatchMatrix[];
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
 * The slot `image` would sample from in this run, or -1 if it cannot join.
 *
 * A bitmap already in the run reuses its slot — but only at the filter it went
 * in under, since MAG_FILTER belongs to the texture object and one draw cannot
 * have it both ways. Otherwise it takes the next free slot, and a run with none
 * left is a run this quad has to break.
 */
export function slotForBitmap(
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
export function slotForRamps(staged: StagedBatchState): number {
  for (let i = 0; i < staged.textures.length; i++) {
    if (staged.textures[i].kind === 'ramps') return i + 1;
  }
  return nextFreeSlot(staged);
}

/** The same for a font atlas, which has no filter to disagree about. */
export function slotForAtlas(staged: StagedBatchState, id: string): number {
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
 * Whether the open run can take an item under this matrix and alpha: it was
 * staged at the live clip depth, and it holds the pair or has room for it.
 */
export function runTakes(
  ctx: DrawContext, staged: StagedBatchState, colorMatrix: Float32Array, alpha: number,
): boolean {
  return staged.clipDepth === runClipDepth(ctx)
    && matrixIndex(staged.matrices, colorMatrix, alpha) >= 0;
}

/** The staged state, opening a run if none is. */
export function openRun(ctx: DrawContext): StagedBatchState {
  ctx.batchState ??= { clipDepth: runClipDepth(ctx), matrices: [], textures: [] };
  return ctx.batchState;
}

/** The index of this matrix and alpha in a run that `runTakes` them, added if
 *  they are new to it. */
export function takeMatrix(
  staged: StagedBatchState, colorMatrix: Float32Array, alpha: number,
): number {
  const index = matrixIndex(staged.matrices, colorMatrix, alpha);
  if (index === staged.matrices.length) staged.matrices.push({ colorMatrix, alpha });
  return index;
}
