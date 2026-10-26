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
import type { LaidOutRuns } from './layoutRuns';
import { paintRuns, type PaintedRuns, type PaintRunsOpts } from './paintRuns';

/** Paintings held for one layout on behalf of runs arrays that have since
 *  gone, before the least recently used is dropped. Sized for a palette. */
export const PAINT_CACHE_VARIANT_LIMIT = 32;

interface Painting {
  /** `glyphGeneration()` when it was painted. */
  generation: number;
  key: string;
  painted: PaintedRuns;
}

/**
 * Two tiers, as the layout cache has and for the same reason. A runs array
 * that stays put, which is what the renderer is handed, keeps its own painting
 * for as long as it and its layout both live: any number of labels can share
 * one layout and none evicts another. Runs built fresh on every call can only
 * be found by what they paint, in a bounded map per layout.
 *
 * Both hang off the layout weakly and hold no reference back to it, so
 * neither keeps one the layout cache has let go.
 */
const own = new WeakMap<readonly ResolvedRun[], WeakMap<LaidOutRuns, OwnPainting>>();

/** A runs array's own painting, and the threshold it was last asked for at.
 *  The runs fix every paint, so an unchanged threshold and glyph generation
 *  is a hit with no key built. */
interface OwnPainting {
  painting: Painting;
  min: number | undefined;
}
const shared = new WeakMap<LaidOutRuns, Map<string, Painting>>();

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
  const sizes = new Set<number>();
  for (const r of runs) sizes.add(r.fontSize);
  let n = 0;
  for (const size of sizes) if (size >= min) n++;
  return n;
}

/** Everything `paintRuns` reads from the runs that their layout does not. */
function variantKey(runs: readonly ResolvedRun[], opts: PaintRunsOpts): string {
  let out = `${outlineBucket(runs, opts.outlineMinSize)}`;
  for (const r of runs) {
    out += `|${r.underline ? 1 : 0}${r.strikethrough ? 1 : 0}${r.overline ? 1 : 0}`
      + `${paintKey(r.fill?.paint)}|${strokeKey(r.stroke)}`;
  }
  return out;
}

/**
 * {@link paintRuns}, reusing the previous result while the paints, the outline
 * threshold's effect, and the glyphs available are what they were. `laid` must
 * be the layout of `runs`, as for `paintRuns`.
 *
 * **The result is shared and must be treated as immutable.**
 */
export function cachedPaintRuns(
  laid: LaidOutRuns,
  runs: readonly ResolvedRun[],
  opts: PaintRunsOpts = {},
): PaintedRuns {
  const generation = glyphGeneration();
  let byLayout = own.get(runs);
  if (byLayout === undefined) {
    byLayout = new WeakMap();
    own.set(runs, byLayout);
  }
  const mine = byLayout.get(laid);
  if (mine !== undefined && mine.min === opts.outlineMinSize && mine.painting.generation === generation) {
    return mine.painting.painted;
  }

  const key = variantKey(runs, opts);
  const fresh = (p: Painting | undefined): p is Painting =>
    p !== undefined && p.generation === generation && p.key === key;
  if (mine !== undefined && fresh(mine.painting)) {
    mine.min = opts.outlineMinSize;
    return mine.painting.painted;
  }

  let byKey = shared.get(laid);
  if (byKey === undefined) {
    byKey = new Map();
    shared.set(laid, byKey);
  }
  let painting = byKey.get(key);
  // Deleted either way, so that setting it below makes it the youngest.
  byKey.delete(key);
  if (!fresh(painting)) painting = { generation, key, painted: paintRuns(laid, runs, opts) };
  if (byKey.size >= PAINT_CACHE_VARIANT_LIMIT) byKey.delete(byKey.keys().next().value!);
  byKey.set(key, painting);
  byLayout.set(laid, { painting, min: opts.outlineMinSize });
  return painting.painted;
}
