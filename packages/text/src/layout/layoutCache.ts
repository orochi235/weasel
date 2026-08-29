/**
 * Laid-out text, memoized. The one entry point every caller of `layoutRuns`
 * should reach for — the renderer's paint path, the silhouette measurement
 * behind picking, and caret hit-testing all answer from this.
 *
 * `layoutRuns` is the most expensive derivation in the kit — it walks every
 * codepoint, resolves a face per run, measures, wraps, aligns, and places a
 * quad or an outline glyph for each — and `drawText` ran it per text command
 * per frame. Measured: 2.0 ms/frame for 200 short labels, 9.3 for 1000, and
 * 25.9 for 200 wrapped paragraphs. That last figure is the entire frame
 * budget spent before a single triangle is drawn.
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
 * Under either, one entry per distinct `(maxWidth, lineHeight, align, outline
 * threshold)`. Position is deliberately absent: `layoutRuns` emits
 * origin-relative geometry and `drawText` translates at upload, so a text node
 * dragged across the page keeps hitting the same entry.
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
 * ### What the keys cannot see
 *
 * The font set. A face landing changes metrics with no change to the runs, so
 * every lookup compares `glyphGeneration()` — advanced by the dynamic SDF
 * atlas, by the outline registry, and by `registerFont` — and drops
 * everything when it moves. That is the same escape hatch `nodeMemo`'s
 * generation counter provides, for the same class of failure. Polled rather
 * than subscribed: a module-load subscription is a cross-package side effect
 * that makes importing this package require the font package's whole surface.
 *
 * ### Bounds
 *
 * Variants per runs array are capped and evicted wholesale, matching
 * `outlineMeshCache`: the refill cost is one layout, and the bookkeeping would
 * cost more than the misses it avoids. The structural map cannot ride an
 * array's lifetime the way the `WeakMap` does — nothing collects its keys —
 * so it is a real LRU with a hard entry count.
 */

import type { FillStyle, Stroke } from '@weasel-js/paint';
import { glyphGeneration } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import { layoutRuns, type LaidOutRuns, type LayoutRunsOpts } from './layoutRuns';

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
}

let cache = new WeakMap<readonly ResolvedRun[], Entry>();
let structural = new Map<string, LaidOutRuns>();
let structuralGeneration = -1;

/**
 * How many of the distinct font sizes present in `runs` reach `min`. Equal
 * counts mean the same set of runs cleared the threshold, since the count is
 * monotonic in `min` over a fixed `runs` — which is what makes this a key.
 * Stroked runs need no term of their own: a stroke pulls its run onto the
 * outline tier at every `min`, so it cannot distinguish two of them.
 *
 * Returns `-1` for an absent threshold, which must stay distinct from "a
 * threshold no run reaches": measurement callers leave it unset, and
 * conflating the two would let a measurement answer a paint.
 */
function outlineBucket(runs: readonly ResolvedRun[], min: number | undefined): number {
  if (min === undefined) return -1;
  const sizes = new Set<number>();
  for (const r of runs) sizes.add(r.fontSize);
  let n = 0;
  for (const size of sizes) if (size >= min) n++;
  return n;
}

function variantKey(runs: readonly ResolvedRun[], opts: LayoutRunsOpts): string {
  return `${opts.maxWidth}|${opts.lineHeight}|${opts.align}|${outlineBucket(runs, opts.outlineMinSize)}`;
}

let nextRefId = 1;
const refIds = new WeakMap<object, number>();

/** A stable id for a paint this key cannot serialize. */
function refId(o: object): number {
  let id = refIds.get(o);
  if (id === undefined) {
    id = nextRefId++;
    refIds.set(o, id);
  }
  return id;
}

/**
 * A paint's contribution to the key. Solid paints compare by value, so two
 * runs set to the same colour share a layout; gradients and patterns get a
 * per-object id, because they have no cheap structural equality and a false
 * positive would hand back groups carrying the wrong paint.
 *
 * `layoutRuns`'s own `fillKey` mints a fresh random string for the non-solid
 * case — fine for grouping within one layout, useless as a cache key.
 */
function paintKey(p: FillStyle): string {
  return 'color' in p ? `s${p.color}:${p.opacity ?? 1}` : `#${refId(p)}`;
}

function strokeKey(s: Stroke | undefined): string {
  if (!s) return '-';
  const width = s.width ?? 1;
  return [
    paintKey(s.paint), typeof width === 'number' ? width : `px${width.px}`,
    s.join ?? 'miter', s.cap ?? 'butt',
    s.miterLimit ?? '', s.align ?? 'center', (s.dash ?? []).join(','),
  ].join(':');
}

/**
 * Everything about `runs` that changes the layout. The two author-supplied
 * strings are length-prefixed so neither can forge a neighbouring field by
 * containing a separator; every other term is a number, an enum, or a paint
 * already escaped by `paintKey`.
 */
function runsKey(runs: readonly ResolvedRun[]): string {
  let out = '';
  for (const r of runs) {
    out += `${r.text.length}:${r.text}|${r.fontFamily.length}:${r.fontFamily}`
      + `|${r.fontSize}|${r.fontWeight}|${r.fontStyle}|${r.letterSpacing}`
      + `|${r.underline ? 1 : 0}${r.strikethrough ? 1 : 0}`
      + `|${paintKey(r.fill)}|${strokeKey(r.stroke)}|`;
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

  const key = variantKey(runs, opts);
  const hit = entry.byVariant.get(key);
  if (hit !== undefined) return hit;

  if (structuralGeneration !== fonts) {
    structural.clear();
    structuralGeneration = fonts;
  }
  const structuralK = `${runsKey(runs)} ${key}`;
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
  return laid;
}

/** Test helper. Do not call from product code. */
export function _resetLayoutCacheForTests(): void {
  cache = new WeakMap();
  structural = new Map();
  structuralGeneration = -1;
}
