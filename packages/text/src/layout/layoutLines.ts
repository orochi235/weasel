/**
 * Measured entries broken into lines, and one line set on its baseline: where
 * each cell and glyph lands once alignment, justification and visual order
 * have had their say.
 */
import type { LineOrder } from './bidiLines';
import { doubles, truncate } from './arrayPool';
import { LineBox, type LayoutColumns } from './layoutColumns';
import type { Entry } from './layoutEntries';
import { hangs, wrapSpans } from './lineBreak/wrapLines';
import { tabAdvance, widthWithTabs } from './tabStops';

/** What breaking and placing lines read of the layout's options. Handed over
 *  in an object, not as arguments: a number passed to a call V8 does not
 *  inline is boxed on every call. */
export interface LineOpts {
  maxWidth: number;
  alignWidth: number;
  lineHeight: number;
  justify: boolean;
}

/** One line's entries, measured and not yet placed. */
export interface Line {
  /** Index of its first entry among the entries that were broken. */
  start: number;
  /** One past its last, excluding the hard break that closed it. */
  end: number;
  /** In logical order. The first has dropped the kerning before it, and a tab
   *  has run out to its stop. */
  entries: Entry[];
  width: number;
  height: number;
  /** Line top to baseline. */
  ascent: number;
  /** Closed by the wrap rather than by a hard break or the end of the text:
   *  the lines `justify` spreads. */
  wrapped: boolean;
  /** Source offset just past the line's last character. */
  srcEnd: number;
}

/**
 * How far above the baseline an entry's inline box reaches, CSS's way: the
 * face's ascent plus half the leading its line height leaves around ascent
 * and descent. A face taller than its line box gets negative leading and
 * overflows the box rather than growing it.
 */
function aboveBaseline(e: Entry, lineHeight: number): number {
  const k = e.lineSize / e.metrics.size;
  const ascent = e.metrics.ascent * k;
  if (e.metrics.descent === undefined) return ascent;
  return (e.lineSize * lineHeight - ascent - e.metrics.descent * k) / 2 + ascent;
}

const NONE: readonly Entry[] = [];
/** The entries the width callbacks below read, set for one {@link breakLines}
 *  call and cleared after it, so the wrap builds no closure a call. */
let cur = NONE;
/** `sum[k]`: width of entries `[0, k)` set end to end. Grown, never shrunk. */
let sum: number[] = doubles(64);
/** Indices of the tabs among `cur`, ascending. */
const tabs: number[] = [];
/** The lines a call broke, and every line object any call has made, reused by
 *  index. Lists here are written by index and cut to length once: `length = 0`
 *  drops an array's backing store, so pushing after it reallocated every call. */
const broken: Line[] = [];
let brokenCount = 0;
const linePool: Line[] = [];
/** The most line objects the pool keeps. */
const LINE_POOL_MAX = 64;

/** An entry opening a line drops the kerning before it. */
function flatWidth(start: number, end: number): number {
  return cur[start].advance + cur[start].tracking + sum[end] - sum[start + 1];
}
const stopOf = (k: number) => cur[k].tab!;
function tabbedWidth(start: number, end: number): number {
  return widthWithTabs(start, end, tabs, stopOf, flatWidth);
}

function pushSpan(start: number, end: number, wrapped: boolean): void {
  const i = brokenCount++;
  let line = linePool[i];
  if (line === undefined) {
    line = { start: 0, entries: [], width: 0.5, height: 0.5, ascent: 0.5, wrapped: false, srcEnd: 0, end: 0 };
    if (i < LINE_POOL_MAX) linePool[i] = line;
  }
  line.start = start; line.end = end; line.wrapped = wrapped;
  line.width = 0; line.height = 0; line.ascent = 0; line.srcEnd = 0;
  broken[i] = line;
}

/**
 * Break `entries` into lines: at hard breaks, and at UAX #14 opportunities
 * when `maxWidth` is finite. A line is as tall as its tallest entry's line
 * box, with one baseline sunk to clear whichever entry reaches highest above
 * it — from unshifted ascents, so a `baselineShift` cannot drag the rest of
 * the line with it. A blank line takes both from the hard break that closed
 * it, the only carrier of a size it has.
 *
 * The entry opening each line has its kerning zeroed, and each tab its
 * advance set, in place. The lines and their `entries` arrays are reused by
 * the next call, so they are valid only until then.
 */
export function breakLines(
  entries: readonly Entry[],
  cps: readonly number[],
  opts: LineOpts,
): Line[] {
  const { maxWidth, lineHeight } = opts;
  if (sum.length < entries.length + 1) sum = doubles(entries.length + 1);
  sum[0] = 0;
  let tabCount = 0;
  brokenCount = 0;
  for (let k = 0; k < entries.length; k++) {
    const e = entries[k];
    sum[k + 1] = sum[k] + e.kerningBefore + e.advance + e.tracking;
    if (e.tab) tabs[tabCount++] = k;
  }
  tabs.length = tabCount;
  cur = entries;
  wrapSpans(cps, maxWidth, tabCount === 0 ? flatWidth : tabbedWidth, pushSpan);
  cur = NONE;
  broken.length = brokenCount;

  for (let i = 0; i < broken.length; i++) {
    const line = broken[i];
    if (line.start === line.end) {
      const brk = entries[line.end];
      line.height = brk.lineSize * lineHeight;
      line.ascent = aboveBaseline(brk, lineHeight);
      line.srcEnd = brk.srcIndex;
      truncate(line.entries, 0);
      continue;
    }
    const out = line.entries;
    for (let k = line.start; k < line.end; k++) {
      const e = entries[k];
      if (k === line.start) e.kerningBefore = 0;
      if (e.tab) e.advance = tabAdvance(line.width, e.tab.stop, e.tab.min);
      out[k - line.start] = e;
      line.width += e.kerningBefore + e.advance + e.tracking;
      line.height = Math.max(line.height, e.lineSize * lineHeight);
      line.ascent = Math.max(line.ascent, aboveBaseline(e, lineHeight));
    }
    out.length = line.end - line.start;
    line.srcEnd = entries[line.end - 1].srcEnd;
  }
  return broken;
}

/** Width of the white space a line ends in. CSS aligns a line on its ink, so
 *  this hangs past the aligned edge; each space keeps its cell and advance. */
function hungWidth(entries: readonly Entry[]): number {
  let hung = 0;
  for (let k = entries.length - 1; k >= 0 && hangs(entries[k].cp); k--) {
    const e = entries[k];
    hung += e.kerningBefore + e.advance + e.tracking;
  }
  return hung;
}

/** Positions of the spaces between a line's words. Leading spaces are
 *  zero-width slots and trailing ones hang, so neither is a gap. */
function wordGaps(entries: readonly Entry[]): Set<number> {
  const gaps = new Set<number>();
  let first = 0;
  while (first < entries.length && entries[first].cp === 32) first++;
  let last = entries.length - 1;
  while (last > first && entries[last].cp === 32) last--;
  for (let k = first + 1; k < last; k++) if (entries[k].cp === 32) gaps.add(k);
  return gaps;
}

/** Where a line's ink starts for `align`. With no box to align in, a line
 *  anchors on its own width, as the canvas-2D `renderLabel` does. */
function alignOffset(align: 'left' | 'center' | 'right', alignWidth: number, inkWidth: number): number {
  if (align === 'left') return 0;
  if (!Number.isFinite(alignWidth)) return align === 'center' ? -inkWidth / 2 : -inkWidth;
  const slack = alignWidth - inkWidth;
  return align === 'center' ? slack / 2 : slack;
}

const NO_GAPS: ReadonlySet<number> = new Set();

/** A line set at its place in the text: one object every {@link placeLine}
 *  call rewrites, so it is valid only until the next. */
export interface PlacedLine {
  box: LineBox;
  /** Width of the line's ink, hung white space left out and any justified
   *  spread counted. */
  inkWidth: number;
}

const placed: PlacedLine = { box: null as unknown as LineBox, inkWidth: 0.5 };

/**
 * Set `line` with its top at `y`: align it in `alignWidth`, spread it when it
 * is `justify`'s to spread, then walk the pen through `order`, storing every
 * entry's cell and placed glyph in `cols` from index `start`. Its box is
 * `cols.boxes[at]`, refilled where the columns already hold one.
 */
export function placeLine(
  line: Line,
  y: number,
  order: LineOrder,
  align: 'left' | 'center' | 'right',
  opts: LineOpts,
  cols: LayoutColumns,
  start: number,
  at: number,
): PlacedLine {
  const { alignWidth, justify } = opts;
  const { entries } = line;
  const hung = hungWidth(entries);
  const inkWidth = line.width - hung;
  const slack = alignWidth - inkWidth;
  const gaps = justify && line.wrapped && Number.isFinite(alignWidth) && slack > 0
    ? wordGaps(entries)
    : NO_GAPS;
  const gapExtra = gaps.size > 0 ? slack / gaps.size : 0;
  const spread = gapExtra * gaps.size;
  const inkLeft = spread > 0 ? 0 : alignOffset(align, alignWidth, inkWidth);
  // L1 gives a line's trailing spaces the paragraph's level, so in a
  // right-to-left paragraph they reorder to the left and hang off that side.
  const hangsLeft = hung > 0 && order.levels[entries.length - 1] % 2 === 1;
  const left = hangsLeft ? inkLeft - hung : inkLeft;
  const lineBaselineY = y + line.ascent;

  let penX = left;
  let prevPos = -1;
  /** The last code point the pen moved past, which the kerning after it widens. */
  let wide = -1;
  let slot = 0;
  const { visual } = order;
  for (let v = 0; v < visual.length; v++) {
    const pos = visual[v];
    const e = entries[pos];
    // Kerning is a gap between two adjacent characters, and the wrap measured
    // it logically. Reordering can put a different pair side by side: take
    // the gap that belongs to whichever of the two is logically second, and
    // none across a direction boundary, where the pair never touched.
    const kern = prevPos < 0 ? 0
      : pos === prevPos + 1 ? e.kerningBefore
      : prevPos === pos + 1 ? entries[prevPos].kerningBefore
      : 0;
    // The gap belongs to the cell on its left, so the cells tile the line;
    // a mark that takes no room leaves it to the glyph it sits on.
    if (kern !== 0) cols.widen(start + (wide >= 0 ? wide : prevPos), kern);
    penX += kern;
    prevPos = pos;
    const step = e.advance + e.tracking + (gaps.has(pos) ? gapExtra : 0);
    if (step !== 0) wide = pos;
    // Positive raises, and y grows down, so the shift subtracts.
    cols.set(start + pos, e, order.levels[pos], penX, step, lineBaselineY - e.baselineShift);
    cols.setVisual(start, slot++, pos);
    penX += step;
  }

  const x1 = left + line.width + spread;
  const y1 = y + line.height;
  const prior = cols.boxes[at];
  placed.box = prior !== undefined
    ? prior.refill(left, y, x1, y1, lineBaselineY, line.srcEnd, spread > 0, start, entries.length)
    : (cols.boxes[at] = new LineBox(left, y, x1, y1, lineBaselineY, line.srcEnd, spread > 0, cols, start, entries.length));
  placed.inkWidth = inkWidth + spread;
  return placed;
}
