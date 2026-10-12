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

/** Distinct paintings held for one layout before the whole set is dropped. */
export const PAINT_CACHE_VARIANT_LIMIT = 8;

interface Entry {
  /** `glyphGeneration()` when this entry was filled. */
  generation: number;
  byVariant: Map<string, PaintedRuns>;
}

const cache = new WeakMap<LaidOutRuns, Entry>();

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
  const glyphs = glyphGeneration();
  let entry = cache.get(laid);
  if (entry === undefined) {
    entry = { generation: glyphs, byVariant: new Map() };
    cache.set(laid, entry);
  } else if (entry.generation !== glyphs) {
    entry.generation = glyphs;
    entry.byVariant.clear();
  }
  const key = variantKey(runs, opts);
  let painted = entry.byVariant.get(key);
  if (painted === undefined) {
    painted = paintRuns(laid, runs, opts);
    if (entry.byVariant.size >= PAINT_CACHE_VARIANT_LIMIT) entry.byVariant.clear();
    entry.byVariant.set(key, painted);
  }
  return painted;
}
