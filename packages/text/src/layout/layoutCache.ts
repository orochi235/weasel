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
 * **Structure**, in a bounded list, for every caller that cannot. Measuring
 * a pose resolves its style and allocates a fresh `ResolvedRun[]` each call,
 * so an identity-keyed cache could never hold anything for it — and those
 * callers run on the drag path, once per pose change. The runs are hashed,
 * and a matching hash compared field by field with the runs that filled the
 * entry, which it holds. No key is built: a HUD readout whose text changes
 * every frame misses here every frame, and a string key was a string of
 * every label's text a frame for the collector. Those held runs are why a
 * run must not be mutated once laid out, the promise the identity key
 * already asks of its array.
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
 * cost more than the misses it avoids. The structural list cannot ride an
 * array's lifetime the way the `WeakMap` does, so it is a real LRU with a
 * hard entry count.
 */

import { faceGeneration } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import { layoutBidi, type LayoutRunsOpts } from './layoutOpts';
import { layoutRuns, type LaidOutRuns } from './layoutRuns';
import { DEFAULT_TAB_SIZE } from './tabStops';

/** Distinct option combinations held for one runs array before the whole set
 *  is dropped. Sized for "a few views onto the same text". */
export const LAYOUT_CACHE_VARIANT_LIMIT = 8;

/** Layouts held against the structural key before the least recently used one
 *  is dropped. Sized for "every text node visible on a page, plus slack". */
export const LAYOUT_CACHE_STRUCTURAL_LIMIT = 64;

/** One option combination, defaults filled in, and the layout made with it. */
interface Variant {
  maxWidth: number; alignWidth: number; lineHeight: number; align: LayoutRunsOpts['align'];
  justify: boolean; direction: NonNullable<LayoutRunsOpts['direction']>; tabSize: number;
  bidi: ReturnType<typeof layoutBidi>; laid: LaidOutRuns;
}

interface Entry {
  /** `faceGeneration()` when this entry was filled. */
  generation: number;
  /** Most recently matched first. */
  variants: Variant[];
}

/** A layout held against the content of the runs that made it. */
interface Structural extends Variant {
  hash: number;
  runs: readonly ResolvedRun[];
  /** When it was last read, for the eviction. */
  used: number;
}

let cache = new WeakMap<readonly ResolvedRun[], Entry>();
let structural: Structural[] = [];
let structuralGeneration = -1;
let clock = 0;

/** `a === b`, with NaN equal to itself, as the string key this replaced had it. */
const same = (a: number | undefined, b: number | undefined): boolean => a === b || (a !== a && b !== b);

function matches(v: Variant, opts: LayoutRunsOpts, bidi: Variant['bidi']): boolean {
  return same(v.maxWidth, opts.maxWidth) && same(v.alignWidth, opts.alignWidth ?? opts.maxWidth)
    && same(v.lineHeight, opts.lineHeight) && v.align === opts.align
    && v.justify === (opts.justify === true || opts.align === 'justify')
    && v.direction === (opts.direction ?? 'auto') && same(v.tabSize, opts.tabSize ?? DEFAULT_TAB_SIZE)
    && v.bidi === bidi;
}

function variant(opts: LayoutRunsOpts, bidi: Variant['bidi'], laid: LaidOutRuns): Variant {
  return {
    maxWidth: opts.maxWidth, alignWidth: opts.alignWidth ?? opts.maxWidth, lineHeight: opts.lineHeight,
    align: opts.align, justify: opts.justify === true || opts.align === 'justify',
    direction: opts.direction ?? 'auto', tabSize: opts.tabSize ?? DEFAULT_TAB_SIZE, bidi, laid,
  };
}

function mix(h: number, n: number): number {
  return Math.imul(h ^ n, 0x01000193);
}

function mixNum(h: number, x: number): number {
  return mix(h, x === (x | 0) ? x : Math.round(x * 4096));
}

function mixStr(h: number, s: string): number {
  h = mix(h, s.length);
  for (let i = 0; i < s.length; i++) h = mix(h, s.charCodeAt(i));
  return h;
}

/** A hash of everything about `runs` that changes the layout: what
 *  {@link sameRuns} compares. Built without allocating, so a miss costs a walk
 *  of the text and nothing for the collector. */
function runsHash(runs: readonly ResolvedRun[]): number {
  let h = mix(0x811c9dc5, runs.length);
  for (const r of runs) {
    h = mixStr(h, r.text);
    h = mixStr(h, r.fontFamily);
    h = mixNum(h, r.fontSize);
    h = mixNum(h, r.fontWeight);
    h = mix(h, r.fontStyle === 'italic' ? 1 : 0);
    h = mixNum(h, r.letterSpacing);
    h = mixNum(h, r.baselineShift);
    h = mixNum(h, r.rotate ?? 0);
    h = mixNum(h, r.strutSize ?? -1);
  }
  return h;
}

function sameNums(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
  return true;
}

/** Whether `a` and `b` lay out alike. A run's paint and decorations are left
 *  out; `cachedPaintRuns` keys on those. */
function sameRuns(a: readonly ResolvedRun[], b: readonly ResolvedRun[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (x.text !== y.text || x.fontFamily !== y.fontFamily || !same(x.fontSize, y.fontSize)
      || !same(x.fontWeight, y.fontWeight) || x.fontStyle !== y.fontStyle
      || !same(x.letterSpacing, y.letterSpacing) || !same(x.baselineShift, y.baselineShift)
      || !same(x.strutSize, y.strutSize) || !same(x.rotate ?? 0, y.rotate ?? 0) || !sameNums(x.sizeMap, y.sizeMap)) return false;
    // Ends follow from starts and the length, so the two pin the cells.
    const sx = x.srcMap, sy = y.srcMap;
    if (sx !== sy && (sx === undefined || sy === undefined || sx.length !== sy.length
      || !sameNums(sx.starts, sy.starts))) return false;
  }
  return true;
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
  const bidi = layoutBidi(opts);
  let entry = cache.get(runs);
  if (entry === undefined) {
    entry = { generation: fonts, variants: [] };
    cache.set(runs, entry);
  } else if (entry.generation !== fonts) {
    entry.generation = fonts;
    entry.variants.length = 0;
  } else {
    const vs = entry.variants;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (!matches(v, opts, bidi)) continue;
      for (let k = i; k > 0; k--) vs[k] = vs[k - 1];
      vs[0] = v;
      return v.laid;
    }
  }

  const laid = structuralLayout(runs, opts, bidi, fonts);
  const vs = entry.variants;
  if (vs.length >= LAYOUT_CACHE_VARIANT_LIMIT) vs.length = 0;
  vs.unshift(variant(opts, bidi, laid));
  return laid;
}

function structuralLayout(
  runs: readonly ResolvedRun[], opts: LayoutRunsOpts, bidi: Variant['bidi'], fonts: number,
): LaidOutRuns {
  if (structuralGeneration !== fonts) {
    structural = [];
    structuralGeneration = fonts;
  }
  const hash = runsHash(runs);
  let oldest = 0;
  for (let i = 0; i < structural.length; i++) {
    const s = structural[i];
    if (s.hash === hash && matches(s, opts, bidi) && sameRuns(s.runs, runs)) {
      s.used = ++clock;
      return s.laid;
    }
    if (s.used < structural[oldest].used) oldest = i;
  }
  const laid = layoutRuns(runs, opts);
  const filled = variant(opts, bidi, laid) as Structural;
  filled.hash = hash; filled.runs = runs; filled.used = ++clock;
  if (structural.length < LAYOUT_CACHE_STRUCTURAL_LIMIT) structural.push(filled);
  else structural[oldest] = filled;
  return laid;
}

/** Test helper. Do not call from product code. */
export function _resetLayoutCacheForTests(): void {
  cache = new WeakMap();
  structural = [];
  structuralGeneration = -1;
  clock = 0;
}
