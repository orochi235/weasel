import { BATCH_TEXTURE_SLOTS, RAMP_SLOT, withHull } from '../shaders/batchFill';
import { HULL_POOL, type HullSet } from '../batchHull';
import { type BatchMatrix, matrixIndex } from './batchMatrices';
import { liveHulls, runClipDepth } from './clip';
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
   * The ramp atlas is not among them: see `ramps`.
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
  /**
   * Whether the run samples the ramp atlas, which always sits at `RAMP_SLOT`
   * rather than the next free slot. It still counts against the run's
   * textures, so the run holds as many as before; the fixed slot is what lets
   * the radial and conic arm of the batch shader fetch it directly.
   */
  ramps: boolean;
  /**
   * The hull sets this run's vertices are tested against, each with where its
   * planes start in the pool the flush uploads (`u_hullPlanes`); absent until
   * one joins. A vertex names its set's planes by start and count.
   */
  hulls?: { set: HullSet; start: number }[];
  /** Planes the pool holds so far. */
  hullPlanes: number;
  /** Whether the run holds glyphs small enough to need area coverage, which
   *  only the batch program's builds with the glyph taps draw. */
  areaGlyphs: boolean;
}

/** One entry in a run's slot list. */
type BatchTexture =
  | { kind: 'bitmap'; image: ImageBitmap; sampling: 'linear' | 'nearest' }
  | { kind: 'atlas'; id: string; fieldScale: readonly [number, number] };

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
  if (staged.ramps) return RAMP_SLOT;
  // Other textures fill from slot 1 up, so `RAMP_SLOT` is taken only once
  // every slot is.
  return nextFreeSlot(staged) < 0 ? -1 : RAMP_SLOT;
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
  const taken = staged.textures.length + (staged.ramps ? 1 : 0);
  return taken + 1 < BATCH_TEXTURE_SLOTS ? staged.textures.length + 1 : -1;
}

/**
 * Whether the open run can take an item under this matrix and alpha: it was
 * staged at the live clip depth, it holds the pair or has room for it, and
 * the same for the live hulls.
 */
export function runTakes(
  ctx: DrawContext, staged: StagedBatchState, colorMatrix: Float32Array, alpha: number,
): boolean {
  return staged.clipDepth === runClipDepth(ctx)
    && matrixIndex(staged.matrices, colorMatrix, alpha) >= 0
    && hullFits(staged, liveHulls(ctx));
}

function hullFits(staged: StagedBatchState, set: HullSet | null): boolean {
  if (set === null || hullEntry(staged, set) !== undefined) return true;
  return staged.hullPlanes + set.count <= HULL_POOL;
}

/** A loop rather than `find`: this runs for every item staged under a hull. */
function hullEntry(staged: StagedBatchState, set: HullSet): { set: HullSet; start: number } | undefined {
  const hulls = staged.hulls;
  if (hulls === undefined) return undefined;
  for (let i = 0; i < hulls.length; i++) if (hulls[i].set === set) return hulls[i];
  return undefined;
}

/** The staged state, opening a run if none is. */
export function openRun(ctx: DrawContext): StagedBatchState {
  ctx.batchState ??= {
    clipDepth: runClipDepth(ctx), matrices: [], textures: [], ramps: false, hullPlanes: 0, areaGlyphs: false,
  };
  return ctx.batchState;
}

/**
 * `slot` naming the live hulls as well, added to a run that `runTakes` them
 * if they are new to it. Unchanged under none.
 */
export function takeHulls(ctx: DrawContext, staged: StagedBatchState, slot: number): number {
  const set = liveHulls(ctx);
  if (set === null) return slot;
  let entry = hullEntry(staged, set);
  if (entry === undefined) {
    entry = { set, start: staged.hullPlanes };
    (staged.hulls ??= []).push(entry);
    staged.hullPlanes += set.count;
  }
  return withHull(slot, entry.start, set.count);
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
