/**
 * Laid-out text, keyed on the runs that produced it.
 *
 * `layoutRuns` is the most expensive derivation in the kit — it walks every
 * codepoint, resolves a face per run, measures, wraps, aligns, and places a
 * quad or an outline glyph for each — and `drawText` ran it per text command
 * per frame. Measured: 2.0 ms/frame for 200 short labels, 9.3 for 1000, and
 * 25.9 for 200 wrapped paragraphs. That last figure is the entire frame
 * budget spent before a single triangle is drawn.
 *
 * ### The key
 *
 * Keyed on the `ResolvedRun[]` **array identity**, the same contract as
 * `cache.ts`'s `WeakMap<Path, Mesh>` — and for the same reason: it makes the
 * entry collectable with whatever owns the runs, and it costs nothing to
 * compare. It also carries the same requirement: whoever produces the runs has
 * to hand back a stable array, or this cache is allocated, consulted, missed
 * and repopulated on every frame. `kit:text`'s memoized `paint` is what makes
 * that true for scene text nodes.
 *
 * Under that, one entry per distinct `(maxWidth, lineHeight, align, outline
 * threshold, origin)`. Origin is part of the key because `layoutRuns` bakes
 * absolute positions; that makes a *moving* text node re-lay out, but not a
 * panning or zooming view, which is the case that matters.
 *
 * ### The outline threshold
 *
 * `outlineMinSize` is derived from the view scale, so recording it literally
 * would miss on every frame of a zoom. It reaches `layoutRuns` through exactly
 * one comparison (`run.fontSize < min`, in `outlineFor`), so what the layout
 * actually depends on is *which runs clear the bar* — and since the test is a
 * plain `>=` on size, that set is pinned by how many of the distinct run sizes
 * clear it. Recording that count is exact, not a quantization: the entry stays
 * valid across every zoom that doesn't cross a glyph size, and is dropped the
 * moment one does.
 *
 * ### What the key cannot see
 *
 * The font set. A face landing changes metrics with no change to the runs, so
 * every lookup compares `glyphGeneration()` — advanced by the dynamic SDF
 * atlas, by the outline registry, and by `registerFont` — and drops
 * everything when it moves. That is the same escape hatch `nodeMemo`'s
 * generation counter provides, for the same class of failure. Polled rather
 * than subscribed: a module-load subscription is a cross-package side effect
 * that makes importing the renderer require the font package's whole surface.
 *
 * ### Bound
 *
 * Variants per runs array are capped and evicted wholesale. A text node
 * dragged across the page produces a distinct origin per frame, which without
 * a cap is an unbounded map hanging off a live node. Wholesale rather than
 * LRU, matching `outlineMeshCache`: the refill cost is one layout, and the
 * bookkeeping would cost more than the misses it avoids.
 */

import {
  layoutRuns,
  type LaidOutRuns,
  type LayoutRunsOpts,
  type LayoutRunsOrigin,
} from 'features/text/atlas/layoutRuns';
import type { ResolvedRun } from 'features/text/runs/resolveRuns';
import { glyphGeneration } from '@weasel-js/font';

/** Distinct option/origin combinations held for one runs array before the
 *  whole set is dropped. Sized for "a few views onto the same text", not for
 *  a drag's worth of origins. */
export const LAYOUT_CACHE_VARIANT_LIMIT = 8;

interface Entry {
  /** `generation` when this entry was filled. */
  generation: number;
  byVariant: Map<string, LaidOutRuns>;
}

let cache = new WeakMap<readonly ResolvedRun[], Entry>();


/**
 * How many of the distinct font sizes present in `runs` reach `min` — the
 * exact thing `layoutRuns` derives from `outlineMinSize`. Returns `-1` for an
 * absent threshold, which must stay distinct from "a threshold no run
 * reaches": measurement callers leave it unset, and conflating the two would
 * let a measurement answer a paint.
 */
function outlineBucket(runs: readonly ResolvedRun[], min: number | undefined): number {
  if (min === undefined) return -1;
  const sizes = new Set<number>();
  for (const r of runs) sizes.add(r.fontSize);
  let n = 0;
  for (const size of sizes) if (size >= min) n++;
  return n;
}

function variantKey(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
  origin: LayoutRunsOrigin,
): string {
  return `${opts.maxWidth}|${opts.lineHeight}|${opts.align}|${outlineBucket(runs, opts.outlineMinSize)}|${origin.x}|${origin.y}`;
}

/**
 * Lay `runs` out, reusing the previous result when nothing it depends on has
 * changed. Drop-in for `layoutRuns` — same arguments, same return value.
 *
 * **The result is shared and must be treated as immutable.** `drawText`
 * applies `verticalAlign` while packing vertices rather than by shifting the
 * layout, precisely so it can be handed the same object every frame.
 */
export function cachedLayoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
  origin: LayoutRunsOrigin,
): LaidOutRuns {
  // Polled, not subscribed. A module-level `subscribeGlyphReady` would be a
  // load-time side effect reaching into another package — it made importing
  // the renderer require the font package's whole surface, breaking any
  // consumer that partially mocks it.
  const fonts = glyphGeneration();
  let entry = cache.get(runs);
  if (entry === undefined) {
    entry = { generation: fonts, byVariant: new Map() };
    cache.set(runs, entry);
  } else if (entry.generation !== fonts) {
    entry.generation = fonts;
    entry.byVariant.clear();
  }

  const key = variantKey(runs, opts, origin);
  const hit = entry.byVariant.get(key);
  if (hit !== undefined) return hit;

  const laid = layoutRuns(runs, opts, origin);
  if (entry.byVariant.size >= LAYOUT_CACHE_VARIANT_LIMIT) entry.byVariant.clear();
  entry.byVariant.set(key, laid);
  return laid;
}

/** Test helper. Do not call from product code. */
export function _resetLayoutCacheForTests(): void {
  cache = new WeakMap();
}
