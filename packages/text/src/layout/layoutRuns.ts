/**
 * Runs-aware text layout: wraps `ResolvedRun[]` into lines and places every
 * glyph on them. What to draw for the result — which glyphs share a draw,
 * which tier paints each, where the decoration rules go — is `paintRuns`'.
 * Nothing here reads a run's paint, so recoloring text never lays it out again.
 *
 * A run's `letterSpacing` (world units, so it does not scale with `fontSize`)
 * is added to the advance *after* every grapheme cluster of that run,
 * including the last one on a line — the CSS `letter-spacing` rule. Trailing
 * tracking therefore widens the measured line width and counts toward
 * wrapping. Spaces are tracked like any other character; a newline is not.
 *
 * Word wrap is applied when `maxWidth` is finite, at UAX #14 break
 * opportunities. Forced line breaks are emitted at UAX #14's hard breaks, none
 * of which lays out a cell. Every run on a line shares one baseline, sunk to
 * clear whichever run reaches highest above it; line height is
 * `max(fontSize * lineHeight)` across the line. A face that states its ascent
 * and descent sits in its line the way CSS sets it — half the leading above the
 * ascent, negative when the face is taller than the line, so its glyphs overflow
 * the box rather than growing it. A run a relative size shrank
 * measures at its `strutSize` for both.
 *
 * `ResolvedRun.baselineShift` displaces a run off that shared baseline. The
 * shift moves the run's glyphs and its own decoration rules together, and does
 * not feed back into the line's baseline or its height.
 *
 * Every coordinate out of here is measured from the text's own top-left: the
 * caller translates. That is what lets a text node be dragged without
 * re-laying out.
 */

import type { BmFont, BmFontChar, GlyphMetrics, ResolveResult } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import { resolveAlign } from '../textStyle';
import { analyzeParagraphs, orderLine } from './bidiLines';
import { directionOfLevel, warnRtlWithoutEngine } from './bidiRegistry';
import { LayoutColumns } from './layoutColumns';
import { measureRuns, mirrorEntries, type Entry } from './layoutEntries';
import { breakLines, placeLine, type LineOpts } from './layoutLines';
import { resolveLayoutOpts, type LayoutRunsOpts } from './layoutOpts';
import type { BidiResolver } from './bidiSeam';
import type { ShapedCluster } from './shaperSeam';
import { isHardLineBreak } from './lineBreak/lineBreaks';

/**
 * One advance cell: a single code point's slot on a line.
 *
 * A cell spans its code point *plus* the kerning that precedes the glyph to
 * its right, so a caret snapped to the midpoint between two `x`s lands where the glyphs
 * were actually painted rather than where an unkerned re-measure would put it.
 */
export interface LaidOutCell {
  /** UTF-16 offset of this code point in the runs' concatenated source text.
   *  Under a length-changing `textTransform` it is the offset of the source
   *  character this one was mapped from, so neighbors can share it — both
   *  `S` cells of an uppercased `ß` do. */
  srcIndex: number;
  /** One past that source character — `srcIndex + 2` for an astral one. */
  srcEnd: number;
  cp: number;
  /** Left edge of the cell, post-alignment, origin-relative.
   *
   *  **Not monotonic across `cells`** once a bidi engine reorders a line: cells
   *  stay in logical order and their x values do not. Sort on `x` for visual
   *  order; never assume `cells[i + 1].x` is this cell's right edge. */
  x: number;
  /** Width of the cell: its glyph's advance, plus its run's tracking when it
   *  closes a grapheme cluster, plus a justified gap's share of the slack,
   *  plus the kerning before the glyph to its right. A cell ends at its right
   *  neighbor's `x`, except across a combining mark that takes no room: the
   *  mark keeps 0 and the glyph it sits on takes the kerning. */
  advance: number;
  /** Resolved bidi embedding level — even reads left-to-right. 0 with no
   *  engine, which is the same as saying the text was laid out logically. */
  level: number;
  /**
   * Whether this code point can put ink on the page. False for a space and
   * for a code point no tier could serve — each of which still holds its
   * slot. A zero-advance combining mark is `true`: it inks without advancing.
   * An emoji drawn as one color glyph inks from its cluster's closing code
   * point, which holds the whole advance; the ones before it are `false`.
   *
   * A property of the character and the face, not of this call: it does not
   * change when a dynamic bake lands or the outline threshold is crossed. A
   * blank-but-servable glyph (NBSP in a face that has one) reports `true`;
   * read the quad or outline geometry for exact ink extents.
   */
  drawsInk: boolean;
  /**
   * Whether this code point closes a grapheme cluster. A caret stops only
   * after a cell that does: never between a letter and its combining mark,
   * inside a joined emoji, or before a variation selector.
   */
  clusterEnd: boolean;
}

/**
 * One code point where the pen put it, with what a painter needs to draw it:
 * the tier that serves it and its record there. Carries no paint.
 */
export interface PlacedGlyph {
  /** Index of its run in the runs laid out. */
  run: number;
  /** Index in its line's `cells` of the code point it draws. */
  cell: number;
  cp: number;
  /** The glyph's own size, which small caps sets below its run's. */
  fontSize: number;
  /** The tier serving the glyph, which is not its run's own when the code
   *  point escalated to the dynamic tier, and that tier's metrics. */
  resolved: ResolveResult;
  metrics: GlyphMetrics;
  /** The atlas to sample and the glyph's record in it. Both null on the
   *  outline tier and for a slot with nothing to draw. A dynamic glyph's
   *  record gains its atlas rect in place when its bake lands. */
  font: BmFont | null;
  glyph: BmFontChar | null;
  /** What it draws when a shaper shaped its run: its cluster's glyphs, set
   *  from this pen, in place of the glyph its code point maps to. Null or
   *  absent when its run was not shaped. */
  shaped?: ShapedCluster | null;
  /** Pen position: the left edge of the glyph's slot. */
  x: number;
  /** Its line's baseline, raised by its run's `baselineShift`. */
  baselineY: number;
  /** The glyph's own advance. */
  advance: number;
  /** How far the pen moved past it: `advance`, its run's tracking, a
   *  justified gap's share of the slack, and the kerning before the next glyph
   *  along the line. */
  step: number;
  /** Degrees its run turns each glyph, clockwise about `(x, baselineY)`, its
   *  pen on the baseline. 0, or absent on a glyph built by hand, is upright.
   *  The turn moves no pen: the glyphs after it sit where they would. */
  rotate?: number;
}

/**
 * One laid-out line's box.
 *
 * `[x0, x1]` is the line's own advance width *after* alignment — not the
 * wrap box — so a short centered line reports the span it actually occupies.
 * `[y0, y1]` is the full line box: `y0` is the pen's line top, and the box is
 * as tall as its tallest run's `lineHeight` times that run's size, or the
 * larger size a shrunken run inherited. Ink can escape it vertically; this is
 * the typographic box, not an ink bounding box.
 *
 * Emitted for every line including empty ones, so indices line up with the
 * wrap. An empty line has `x0 === x1`.
 */
export interface LaidOutLineBox {
  x0: number; y0: number; x1: number; y1: number;
  /** The line's baseline, for callers placing carets or rules against it. */
  baselineY: number;
  /**
   * One cell per code point on this line, in logical order. Every code point
   * the line covers has exactly one, drawn or not; only a newline has none,
   * since it separates cells rather than being one. The code points are the
   * drawn ones, after `textTransform`, so an uppercased `ß` has two cells.
   *
   * A caret stop is a cell's `x`, and the stop closing the line is `x1` /
   * `srcEnd` — there is one more stop than cell, except that cells sharing a
   * source span have no stop between them.
   */
  cells: LaidOutCell[];
  /** The same code points as placed glyphs, in visual order, left to right. */
  glyphs: PlacedGlyph[];
  /**
   * Source offset just past this line's last cell — the closing caret stop's
   * index, and the only source offset a blank line carries.
   */
  srcEnd: number;
  /** Whether `justify` spread this line's slack across its word gaps — never
   *  for a line closing its paragraph, or one with no gap or no slack. */
  justified: boolean;
}

/** What {@link layoutRuns} returns. Every coordinate is relative to the text's own top-left. */
export interface LaidOutRuns {
  /** Per-line boxes in layout order: where the text actually sits inside its
   *  wrap box. */
  lines: LaidOutLineBox[];
  /** The text's box. `width` is the widest line measured to its last
   *  non-space cell — a trailing space hangs past the aligned edge, so a
   *  block wrapped at `maxWidth` never reports wider than it. `height` is the
   *  line boxes stacked. Not an ink box: a decoration rule, or a run shifted
   *  off the baseline, can fall outside it. */
  bounds: { width: number; height: number };
}

/** The entries every layout measures into, the list holding them, and their
 *  code points: none outlives the layout that measured it. */
const ENTRY_POOL: Entry[] = [];
const ENTRIES: Entry[] = [];
const CPS: number[] = [];
/** The options of the layout running now, read into locals before anything
 *  else can lay out. */
const OPTS = resolveLayoutOpts({ maxWidth: 0, lineHeight: 0, align: 'left' });
/** The ones its lines read, set once measuring is done. */
const LINE_OPTS: LineOpts = { maxWidth: 0.5, alignWidth: 0.5, lineHeight: 0.5, justify: false };

// Neither closure is built inside `layoutRuns`: one that captured its locals
// made every call allocate the scope they live in, bidi engine or not.
const hardBreakAt = (i: number): boolean => isHardLineBreak(CPS[i]);

function mirrorLine(
  bidi: BidiResolver, entries: readonly Entry[], levels: readonly number[], runs: readonly ResolvedRun[],
): Entry[] {
  return mirrorEntries(entries, levels, (cp) => bidi.mirror(cp), runs);
}

/**
 * Lay out `runs` into lines of placed glyphs. Wrapping, baselines and tracking
 * follow the rules in this file's module doc.
 */
export function layoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
): LaidOutRuns {
  const {
    maxWidth, alignWidth, lineHeight, align, justify, bidi, shaper, direction, tabSize,
  } = resolveLayoutOpts(opts, OPTS);
  const entries = measureRuns(runs, tabSize, ENTRY_POOL, ENTRIES, shaper);
  const cps = CPS;
  cps.length = entries.length;
  for (let k = 0; k < entries.length; k++) cps[k] = entries[k].cp;
  // Each paragraph is analyzed once; each line then asks for its own range,
  // because L1 resets trailing whitespace against a line's end.
  const paragraphs = bidi
    ? analyzeParagraphs(bidi, cps, hardBreakAt, direction)
    : null;
  if (!bidi) warnRtlWithoutEngine(cps);

  const lineOpts = LINE_OPTS;
  lineOpts.maxWidth = maxWidth; lineOpts.alignWidth = alignWidth;
  lineOpts.lineHeight = lineHeight; lineOpts.justify = justify;
  const broken = breakLines(entries, cps, lineOpts);
  let size = 0;
  for (let i = 0; i < broken.length; i++) size += broken[i].entries.length;
  const cols = broken.length > 0 ? LayoutColumns.take(size) : null;
  const lines: LaidOutLineBox[] = cols !== null ? cols.boxes : [];
  let y = 0;
  let width = 0;
  let start = 0;
  for (let i = 0; i < broken.length; i++) {
    const line = broken[i];
    const order = orderLine(paragraphs, line.start, line.entries.length);
    // L4, done per line rather than during analysis: the same code point
    // mirrors in one run and not in another, and the level is known only now.
    if (bidi) line.entries = mirrorLine(bidi, line.entries, order.levels, runs);
    const reads = direction !== 'auto' ? direction
      : directionOfLevel(line.entries.length > 0 ? paragraphs?.baseLevel(line.start) ?? 0 : 0);
    const placed = placeLine(
      line, y, order, resolveAlign(align, reads), lineOpts, cols!, start, i,
    );
    start += line.entries.length;
    width = Math.max(width, placed.inkWidth);
    y += line.height;
  }
  lines.length = broken.length;
  if (cols === null) return { lines, bounds: { width, height: y } };
  cols.bounds.width = width;
  cols.bounds.height = y;
  return (cols.laid ??= { lines, bounds: cols.bounds });
}
