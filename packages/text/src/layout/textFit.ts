/**
 * Shrink to fit: the largest scale, at most 1, at which a text's runs lay out
 * inside a box, wrapping as they would at that size. Every size and spacing a
 * run carries scales with it, so the lines are what the text set at that
 * smaller size lays out into.
 */
import { faceGeneration } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import type { ResolvedTextStyle } from '../textStyle';
import type { LayoutRunsOpts } from './layoutOpts';
import { LineBox } from './layoutColumns';
import { layoutRuns } from './layoutRuns';
import { runsHash, same, sameRuns } from './runsKey';

/**
 * How a text node's size answers to its box. `'none'`, the default, sets the
 * text at its own size whatever the box. `'shrink'` scales every size in it
 * down, never up, to the largest at which its lines fit the box's width and
 * height, wrapping at the box width when the style wraps.
 */
export type TextFit = 'none' | 'shrink';

/** The search stops once the scale is known to within this fraction of itself: a 100-unit headline lands within 0.1. */
export const TEXT_FIT_TOLERANCE = 1 / 1024;

/** Halvings the search makes at most, past its first two layouts. */
const MAX_HALVINGS = 24;

/** Fits held before the least recently used is dropped: "every fitted node on a page". */
const FIT_CACHE_LIMIT = 64;

interface Fit {
  hash: number;
  runs: readonly ResolvedRun[];
  opts: LayoutRunsOpts;
  width: number;
  height: number;
  scale: number;
  used: number;
}

let fits: Fit[] = [];
let fitsGeneration = -1;
let clock = 0;

const sameOpts = (a: LayoutRunsOpts, b: LayoutRunsOpts): boolean =>
  same(a.maxWidth, b.maxWidth) && same(a.alignWidth, b.alignWidth) && same(a.lineHeight, b.lineHeight)
  && a.align === b.align && a.justify === b.justify && a.direction === b.direction && same(a.tabSize, b.tabSize);

/** `run` set at `k` times its size: its glyphs, tracking, rise and strut. */
function scaledRun(run: ResolvedRun, k: number): ResolvedRun {
  const out: ResolvedRun = {
    ...run, fontSize: run.fontSize * k, letterSpacing: run.letterSpacing * k, baselineShift: run.baselineShift * k,
  };
  if (run.sizeMap) out.sizeMap = run.sizeMap.map((s) => s * k);
  if (run.strutSize !== undefined) out.strutSize = run.strutSize * k;
  return out;
}

/** `runs` set at `k` times their size. */
export function scaleRuns(runs: readonly ResolvedRun[], k: number): ResolvedRun[] {
  return runs.map((r) => scaledRun(r, k));
}

/** `style` at `k` times its size and tracking. */
export function scaleStyle(style: ResolvedTextStyle, k: number): ResolvedTextStyle {
  return { ...style, fontSize: style.fontSize * k, letterSpacing: style.letterSpacing * k };
}

/** The bounds of `runs` set at `k` times their size, laid out uncached, their arrays given straight back. */
function boundsAt(runs: readonly ResolvedRun[], opts: LayoutRunsOpts, k: number): { width: number; height: number } {
  const laid = layoutRuns(k === 1 ? runs : scaleRuns(runs, k), opts);
  const bounds = { ...laid.bounds };
  const cols = laid.lines.length > 0 ? LineBox.columns(laid.lines[0]!) : null;
  cols?.recycle();
  return bounds;
}

function search(runs: readonly ResolvedRun[], opts: LayoutRunsOpts, width: number, height: number): number {
  // A hair of slack: a scale found exactly is found again to the last bit only sometimes.
  const inside = (b: { width: number; height: number }): boolean =>
    b.width <= width * (1 + 1e-9) + 1e-9 && b.height <= height * (1 + 1e-9) + 1e-9;
  const whole = boundsAt(runs, opts, 1);
  if (inside(whole)) return 1;
  // Unwrapped text grows in proportion to its size, so this is the answer
  // there, and a starting point under a wrap.
  const guess = Math.min(whole.width > 0 ? width / whole.width : 1, whole.height > 0 ? height / whole.height : 1);
  let lo = 0;
  let hi = 1;
  if (guess > 0 && inside(boundsAt(runs, opts, guess))) {
    if (!Number.isFinite(opts.maxWidth)) return guess;
    lo = guess;
  } else if (guess > 0) {
    hi = guess;
  }
  for (let i = 0; i < MAX_HALVINGS && hi - lo > TEXT_FIT_TOLERANCE * hi; i++) {
    const mid = (lo + hi) / 2;
    if (inside(boundsAt(runs, opts, mid))) lo = mid;
    else hi = mid;
  }
  // A box nothing fits, zero-sized, takes the smallest scale tried rather than no text at all.
  return lo > 0 ? lo : hi;
}

/**
 * The scale at which `runs`, laid out with `opts`, fit a box `width` by
 * `height`: 1 when they fit as they are, else the largest found to within
 * {@link TEXT_FIT_TOLERANCE}. Deterministic and bounded: a binary search of at
 * most 26 layouts, about 12 in practice, remembered per input until a face lands.
 */
export function shrinkScale(
  runs: readonly ResolvedRun[], opts: LayoutRunsOpts, width: number, height: number,
): number {
  const fonts = faceGeneration();
  if (fitsGeneration !== fonts) {
    fits = [];
    fitsGeneration = fonts;
  }
  const hash = runsHash(runs);
  let oldest = 0;
  for (let i = 0; i < fits.length; i++) {
    const f = fits[i]!;
    if (f.hash === hash && same(f.width, width) && same(f.height, height) && sameOpts(f.opts, opts) && sameRuns(f.runs, runs)) {
      f.used = ++clock;
      return f.scale;
    }
    if (f.used < fits[oldest]!.used) oldest = i;
  }
  const scale = search(runs, opts, width, height);
  const entry: Fit = { hash, runs, opts: { ...opts }, width, height, scale, used: ++clock };
  if (fits.length >= FIT_CACHE_LIMIT) fits[oldest] = entry;
  else fits.push(entry);
  return scale;
}

/** Test helper. Do not call from product code. */
export function _resetTextFitForTests(): void {
  fits = [];
  fitsGeneration = -1;
  clock = 0;
}
