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
import { LineBox } from './layoutColumns';
import type { LaidOutRuns } from './layoutRuns';
import { giveGroup, NO_QUADS } from './paintGroups';
import { paintRunsInto, type PaintedRuns, type PaintRunsOpts } from './paintRuns';

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
/** Each layout's paintings, most recently used last: on its columns, or here
 *  for a layout built by hand. */
const shared = new WeakMap<LaidOutRuns, Painting[]>();

function listOf(laid: LaidOutRuns): Painting[] {
  const cols = laid.lines.length > 0 ? LineBox.columns(laid.lines[0]) : null;
  if (cols !== null) return cols.paintings as Painting[];
  let list = shared.get(laid);
  if (list === undefined) shared.set(laid, (list = []));
  return list;
}

/** Paintings of recycled layouts, their groups and decorations arrays
 *  emptied, for the next painting. */
const spare: Painting[] = [];
const SPARE_MAX = 1024;

function painting(
  laid: LaidOutRuns, runs: readonly ResolvedRun[], opts: PaintRunsOpts,
  generation: number, key: string | null, bucket: number,
): Painting {
  const p = spare.pop();
  if (p === undefined) {
    return {
      generation, key, bucket, runs: key === null ? runs : null,
      painted: paintRunsInto(laid, runs, opts, { groups: [], decorations: [] }), pinned: false,
    };
  }
  p.generation = generation; p.key = key; p.bucket = bucket; p.runs = key === null ? runs : null;
  p.pinned = false;
  paintRunsInto(laid, runs, opts, p.painted);
  return p;
}

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

  const list = listOf(laid);
  let p: Painting | null = null;
  if (list.length > 0) {
    const key = variantKey(runs, bucket);
    for (let i = 0; i < list.length; i++) {
      const held = list[i];
      if (held.bucket !== bucket || keyOf(held) !== key) continue;
      list.splice(i, 1);
      if (held.generation === generation) p = held;
      break;
    }
    p ??= painting(laid, runs, opts, generation, key, bucket);
  } else {
    p = painting(laid, runs, opts, generation, null, bucket);
  }
  if (list.length >= PAINT_CACHE_VARIANT_LIMIT) list.shift();
  list.push(p);
  if (mine !== undefined) {
    mine.laid = laid; mine.painting = p; mine.min = min;
  } else {
    const o = spareOwn.pop();
    if (o === undefined) {
      own.set(runs, { laid, painting: p, min });
    } else {
      o.laid = laid; o.painting = p; o.min = min;
      own.set(runs, o);
    }
  }
  return handOut(p, use);
}

function handOut(p: Painting, use: CacheUse): PaintedRuns {
  if (use === 'keep') p.pinned = true;
  return p.painted;
}

/** Forget the painting held for `runs`, which `dropRuns` was told will not be
 *  drawn again. */
export function forgetPaintRuns(runs: readonly ResolvedRun[]): void {
  const mine = own.get(runs);
  if (mine === undefined) return;
  own.delete(runs);
  if (spareOwn.length < SPARE_MAX) spareOwn.push(mine);
}

/** Entries `forgetPaintRuns` let go, for the next runs arrays' own paintings. */
const spareOwn: OwnPainting[] = [];

/** Drop every painting of `laid`, which no caller can reach any more, giving
 *  those no caller kept, with their groups and quad arrays, to the next
 *  paintings. */
export function recyclePaintings(laid: LaidOutRuns): void {
  const cols = laid.lines.length > 0 ? LineBox.columns(laid.lines[0]) : null;
  let list: Painting[] | undefined;
  if (cols !== null) {
    list = cols.paintings as Painting[];
  } else {
    list = shared.get(laid);
    if (list === undefined) return;
    shared.delete(laid);
  }
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.pinned) continue;
    const { groups } = p.painted;
    for (let k = 0; k < groups.length; k++) {
      const group = groups[k];
      if (group.quadData.length > 0) giveDoubles(group.quadData as number[]);
      group.quadData = NO_QUADS;
      giveGroup(group);
    }
    groups.length = 0;
    p.painted.decorations.length = 0;
    p.runs = null;
    p.key = null;
    if (spare.length < SPARE_MAX) spare.push(p);
  }
  list.length = 0;
}
