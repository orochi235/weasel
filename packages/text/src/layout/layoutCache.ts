/**
 * Laid-out text, memoized. The one entry point every caller of `layoutRuns`
 * should reach for — the renderer's paint path, the silhouette measurement
 * behind picking, and caret hit-testing all answer from this.
 *
 * `layoutRuns` is the most expensive derivation in the kit — it walks every
 * codepoint, resolves a face per run, measures, wraps, aligns, and places
 * every glyph — and `drawText` ran it per text command per frame. Measured,
 * when it also built the draw groups: 2.0 ms/frame for 200 short labels, 9.3
 * for 1000, and 25.9 for 200 wrapped paragraphs.
 *
 * ### Two keys, tried in order
 *
 * **Array identity**, in a `WeakMap`, the same contract as the renderer's
 * `WeakMap<Path, Mesh>` — and for the same reason: it makes the entry
 * collectable with whatever owns the runs, and the lookup is a pointer
 * compare. `kit:text`'s memoized `paint` hands back a stable array per node,
 * so the renderer stays on this path.
 *
 * **Structure**, in a bounded `Map`, for every caller that cannot. Measuring
 * a pose resolves its style and allocates a fresh `ResolvedRun[]` each call,
 * so an identity-keyed cache could never hold anything for it — and those
 * callers run on the drag path, once per pose change. Serializing the runs is
 * real work, unlike the pointer compare above, which is exactly why it is
 * second: an identity hit never pays for it.
 *
 * Under either, one entry per distinct `(maxWidth, alignWidth, lineHeight,
 * align, direction, bidi engine, tab size)`. Position is deliberately absent:
 * `layoutRuns` emits origin-relative geometry and `drawText` translates at
 * upload, so a text node dragged across the page keeps hitting the same entry.
 * So is everything that only changes what is drawn — a run's fill, stroke and
 * decorations, the outline threshold — which `cachedPaintRuns` keys on
 * instead. Two runs arrays that differ only there share one layout.
 *
 * ### What the keys cannot see
 *
 * The font set. A face landing changes metrics with no change to the runs, so
 * every lookup compares `faceGeneration()` — advanced by a registration, a
 * load, a fallback policy, and the dynamic atlas measuring a face again or
 * emptying its pages — and drops everything when it moves. A deferred bake
 * landing does not advance it: that fills in a glyph record the layout
 * already holds, and moves no pen. Polled rather than subscribed: a
 * module-load subscription is a cross-package side effect that makes importing
 * this package require the font package's whole surface.
 *
 * ### Bounds
 *
 * Variants per runs array are capped and evicted wholesale, matching
 * `outlineMeshCache`: the refill cost is one layout, and the bookkeeping would
 * cost more than the misses it avoids. The structural map cannot ride an
 * array's lifetime the way the `WeakMap` does — nothing collects its keys —
 * so it is a real LRU with a hard entry count.
 */

import { faceGeneration } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import { layoutBidi, resolveLayoutOpts, type LayoutRunsOpts } from './layoutOpts';
import { layoutRuns, type LaidOutRuns } from './layoutRuns';
import { refId } from './refId';

/** Distinct option combinations held for one runs array before the whole set
 *  is dropped. Sized for "a few views onto the same text". */
export const LAYOUT_CACHE_VARIANT_LIMIT = 8;

/** Layouts held against the structural key before the least recently used one
 *  is dropped. Sized for "every text node visible on a page, plus slack". */
export const LAYOUT_CACHE_STRUCTURAL_LIMIT = 64;

interface Entry {
  /** `generation` when this entry was filled. */
  generation: number;
  byVariant: Map<string, LaidOutRuns>;
  /** The options and layout of the last lookup, compared field by field
   *  before any key is built: a command drawn every frame with the same
   *  options would otherwise build its variant key string every frame. */
  last: LastLookup | null;
}

interface LastLookup {
  maxWidth: number; alignWidth: number | undefined; lineHeight: number; align: LayoutRunsOpts['align'];
  justify: boolean | undefined; direction: LayoutRunsOpts['direction']; tabSize: number | undefined;
  bidi: ReturnType<typeof layoutBidi>; laid: LaidOutRuns;
}

function sameLookup(l: LastLookup, opts: LayoutRunsOpts): boolean {
  return l.maxWidth === opts.maxWidth && l.alignWidth === opts.alignWidth
    && l.lineHeight === opts.lineHeight && l.align === opts.align && l.justify === opts.justify
    && l.direction === opts.direction && l.tabSize === opts.tabSize && l.bidi === layoutBidi(opts);
}

let cache = new WeakMap<readonly ResolvedRun[], Entry>();
let structural = new Map<string, LaidOutRuns>();
let structuralGeneration = -1;

function variantKey(opts: LayoutRunsOpts): string {
  const o = resolveLayoutOpts(opts);
  return `${o.maxWidth}|${o.alignWidth}|${o.lineHeight}|${o.align}|${o.justify ? 'j' : ''}`
    + `|${o.direction}|${o.bidi ? refId(o.bidi) : ''}|${o.tabSize}`;
}

/**
 * Everything about `runs` that changes the layout. The two author-supplied
 * strings are length-prefixed so neither can forge a neighbouring field by
 * containing a separator; every other term is a number or an enum.
 */
function runsKey(runs: readonly ResolvedRun[]): string {
  let out = '';
  for (const r of runs) {
    out += `${r.text.length}:${r.text}|${r.fontFamily.length}:${r.fontFamily}`
      + `|${r.fontSize}|${r.fontWeight}|${r.fontStyle}|${r.letterSpacing}`
      + `|${r.baselineShift}|${r.strutSize ?? ''}`
      // Ends follow from starts and the length, so the two pin the cells.
      + `|${r.srcMap ? `${r.srcMap.length}:${r.srcMap.starts.join(',')}` : ''}`
      + `|${r.sizeMap ? r.sizeMap.join(',') : ''}|`;
  }
  return out;
}

/**
 * Lay `runs` out, reusing the previous result when nothing it depends on has
 * changed. Drop-in for `layoutRuns` — same arguments, same return value.
 *
 * **The result is shared and must be treated as immutable.** `drawText`
 * applies position and `verticalAlign` while packing vertices rather than by
 * shifting the layout, precisely so it can be handed the same object every
 * frame.
 */
export function cachedLayoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
): LaidOutRuns {
  const fonts = faceGeneration();
  let entry = cache.get(runs);
  if (entry === undefined) {
    entry = { generation: fonts, byVariant: new Map(), last: null };
    cache.set(runs, entry);
  } else if (entry.generation !== fonts) {
    entry.generation = fonts;
    entry.byVariant.clear();
    entry.last = null;
  } else if (entry.last !== null && sameLookup(entry.last, opts)) {
    return entry.last.laid;
  }

  const key = variantKey(opts);
  const hit = entry.byVariant.get(key);
  if (hit !== undefined) return remember(entry, opts, hit);

  if (structuralGeneration !== fonts) {
    structural.clear();
    structuralGeneration = fonts;
  }
  const structuralK = `${runsKey(runs)}\0${key}`;
  let laid = structural.get(structuralK);
  if (laid !== undefined) {
    // Re-insert to move it to the young end; `Map` iterates in insertion order,
    // which is what makes `keys().next()` the least recently used.
    structural.delete(structuralK);
  } else {
    laid = layoutRuns(runs, opts);
    if (structural.size >= LAYOUT_CACHE_STRUCTURAL_LIMIT) {
      structural.delete(structural.keys().next().value!);
    }
  }
  structural.set(structuralK, laid);

  if (entry.byVariant.size >= LAYOUT_CACHE_VARIANT_LIMIT) entry.byVariant.clear();
  entry.byVariant.set(key, laid);
  return remember(entry, opts, laid);
}

function remember(entry: Entry, opts: LayoutRunsOpts, laid: LaidOutRuns): LaidOutRuns {
  entry.last = {
    maxWidth: opts.maxWidth, alignWidth: opts.alignWidth, lineHeight: opts.lineHeight, align: opts.align,
    justify: opts.justify, direction: opts.direction, tabSize: opts.tabSize, bidi: layoutBidi(opts), laid,
  };
  return laid;
}

/** Test helper. Do not call from product code. */
export function _resetLayoutCacheForTests(): void {
  cache = new WeakMap();
  structural = new Map();
  structuralGeneration = -1;
}
