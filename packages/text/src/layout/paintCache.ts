/**
 * `paintRuns`, memoized against the layout it was derived from.
 *
 * Kept apart from the layout cache because the two go stale for different
 * reasons: a recolor, a zoom across the outline threshold, or a dynamic bake
 * landing changes what is drawn and leaves every glyph where it was.
 */
import { glyphGeneration } from '@weasel-js/font';
import { paintKey, strokeKey } from '@weasel-js/paint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { giveDoubles } from './arrayPool';
import type { CacheUse } from './layoutCache';
import type { LaidOutRuns } from './layoutRuns';
import { paintRuns, type PaintedRuns, type PaintRunsOpts } from './paintRuns';

/** Paintings held for one layout on behalf of runs arrays that have since
 *  gone, before the least recently used is dropped. Sized for a palette. */
export const PAINT_CACHE_VARIANT_LIMIT = 32;

interface Painting {
  /** `glyphGeneration()` when it was painted. */
  generation: number;
  /** What it paints, built only once a second runs array asks this layout
   *  for a painting: until then nothing has to be told apart from it. */
  key: string | null;
  /** The bucket of the threshold it was painted at, and the runs it was
   *  painted for, held until `key` is built from them. */
  bucket: number;
  runs: readonly ResolvedRun[] | null;
  painted: PaintedRuns;
  /** Whether a caller was handed it to keep, which bars its quad arrays from
   *  going back to the pool with its layout. */
  pinned: boolean;
}

/**
 * Two tiers, as the layout cache has and for the same reason. A runs array
 * that stays put, which is what the renderer is handed, keeps its own painting
 * for as long as it lives: any number of labels can share one layout and none
 * evicts another. Runs built fresh on every call can only be found by what
 * they paint, in a bounded list per layout, which hangs off the layout weakly.
 *
 * Text whose runs and layout are both new, a readout rewritten every frame,
 * builds no key at all: the list for a fresh layout is empty, and a key is
 * built only when there is something to compare it with.
 */
const own = new WeakMap<readonly ResolvedRun[], OwnPainting>();

/** A runs array's own painting, the layout it was painted on, and the
 *  threshold it was last asked for at. The runs fix every paint, so the same
 *  layout at an unchanged threshold and glyph generation is a hit with no key
 *  built. One layout a runs array: the layout cache holds that one already. */
interface OwnPainting {
  laid: LaidOutRuns;
  painting: Painting;
  min: number | undefined;
}
/** Most recently used last. */
const shared = new WeakMap<LaidOutRuns, Painting[]>();

/**
 * How many of the distinct font sizes present in `runs` reach `min`. The
 * threshold reaches `paintRuns` through one comparison against a run's size,
 * and the count is monotonic in `min` over fixed runs, so equal counts mean
 * the same runs cleared it. That keeps an entry across every zoom that crosses
 * no run size, where keying on `min` itself would miss on every frame.
 * Stroked runs need no term of their own: a stroke pulls its run onto the
 * outline tier at every `min`.
 *
 * `-1` is an absent threshold, which must stay distinct from one no run
 * reaches: an outline-only face aside, neither draws outlines, but only the
 * first leaves a stroked run on its atlas.
 */
function outlineBucket(runs: readonly ResolvedRun[], min: number | undefined): number {
  if (min === undefined) return -1;
  let n = 0;
  for (let i = 0; i < runs.length; i++) {
    const size = runs[i].fontSize;
    if (!(size >= min)) continue;
    let seen = false;
    for (let j = 0; j < i && !seen; j++) seen = runs[j].fontSize === size;
    if (!seen) n++;
  }
  return n;
}

/** Everything `paintRuns` reads from the runs that their layout does not. */
function variantKey(runs: readonly ResolvedRun[], bucket: number): string {
  let out = `${bucket}`;
  for (const r of runs) {
    out += `|${r.underline ? 1 : 0}${r.strikethrough ? 1 : 0}${r.overline ? 1 : 0}`
      + `${paintKey(r.fill?.paint)}|${strokeKey(r.stroke)}`;
  }
  return out;
}

function keyOf(p: Painting): string {
  if (p.key === null) {
    p.key = variantKey(p.runs!, p.bucket);
    p.runs = null;
  }
  return p.key;
}

/**
 * {@link paintRuns}, reusing the previous result while the paints, the outline
 * threshold's effect, and the glyphs available are what they were. `laid` must
 * be the layout of `runs`, as for `paintRuns`.
 *
 * **The result is shared and must be treated as immutable.** `use` is as for
 * `cachedLayoutRuns`: a `'read'` painting's quads go back to the pool with its
 * layout.
 */
export function cachedPaintRuns(
  laid: LaidOutRuns,
  runs: readonly ResolvedRun[],
  opts: PaintRunsOpts = {},
  use: CacheUse = 'keep',
): PaintedRuns {
  const generation = glyphGeneration();
  const min = opts.outlineMinSize;
  const mine = own.get(runs);
  const mineHere = mine !== undefined && mine.laid === laid && mine.painting.generation === generation;
  if (mineHere && mine.min === min) return handOut(mine.painting, use);

  const bucket = outlineBucket(runs, min);
  if (mineHere && mine.painting.bucket === bucket) {
    mine.min = min;
    return handOut(mine.painting, use);
  }

  let list = shared.get(laid);
  if (list === undefined) {
    list = [];
    shared.set(laid, list);
  }
  let painting: Painting | null = null;
  if (list.length > 0) {
    const key = variantKey(runs, bucket);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.bucket !== bucket || keyOf(p) !== key) continue;
      list.splice(i, 1);
      if (p.generation === generation) painting = p;
      break;
    }
    if (painting === null) {
      painting = { generation, key, bucket, runs: null, painted: paintRuns(laid, runs, opts), pinned: false };
    }
  } else {
    painting = { generation, key: null, bucket, runs, painted: paintRuns(laid, runs, opts), pinned: false };
  }
  if (list.length >= PAINT_CACHE_VARIANT_LIMIT) list.shift();
  list.push(painting);
  if (mine !== undefined) {
    mine.laid = laid; mine.painting = painting; mine.min = min;
  } else {
    own.set(runs, { laid, painting, min });
  }
  return handOut(painting, use);
}

function handOut(p: Painting, use: CacheUse): PaintedRuns {
  if (use === 'keep') p.pinned = true;
  return p.painted;
}

/** Forget the painting held for `runs`, which `dropRuns` was told will not be
 *  drawn again. */
export function forgetPaintRuns(runs: readonly ResolvedRun[]): void {
  // Pointed at no layout rather than deleted, as `dropRuns` empties its entry.
  const mine = own.get(runs);
  if (mine !== undefined) mine.laid = NO_LAYOUT;
}

const NO_LAYOUT: LaidOutRuns = { lines: [], bounds: { width: 0, height: 0 } };

/** Drop every painting of `laid`, which no caller can reach any more, giving
 *  the quad arrays of those no caller kept back to the pool. */
export function recyclePaintings(laid: LaidOutRuns): void {
  const list = shared.get(laid);
  if (list === undefined) return;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.pinned) continue;
    const { groups } = p.painted;
    for (let k = 0; k < groups.length; k++) {
      const group = groups[k];
      if (group.quadData.length === 0) continue;
      giveDoubles(group.quadData as number[]);
      group.quadData = EMPTY;
    }
  }
  // Emptied, not deleted: the entry goes with `laid`.
  list.length = 0;
}

const EMPTY: readonly number[] = [];
