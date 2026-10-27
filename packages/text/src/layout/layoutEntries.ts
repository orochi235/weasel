/**
 * Runs measured code point by code point: which glyph serves each one, how
 * far it advances, and the kerning before it. Nothing here knows about lines.
 *
 * A grapheme cluster with emoji presentation is the exception to one glyph a
 * code point: where the canvas tier draws a color glyph for it, that glyph
 * sits in the slot of the cluster's closing code point, and the code points
 * before it are slots with nothing in them.
 */
import {
  glyphIn, metricsOf, resolveColorCluster, resolveFontVariant, resolveGlyph, warnNoMetrics,
  type BmFont, type BmFontChar, type GlyphMetrics, type ResolvedGlyph, type ResolveResult,
} from '@weasel-js/font';
import { graphemeEnds } from '../measure/graphemes';
import type { ResolvedRun } from '../runs/resolveRuns';
import { isHardLineBreak } from './lineBreak/lineBreaks';
import type { TabStop } from './tabStops';

/** A mark that takes no width of its own, which kerning reads through. */
const NONSPACING_MARK = /^[\p{Mn}\p{Me}]$/u;

/** One code point of the runs, measured. Widths are world units. */
export interface Entry {
  /** Index of its run in the runs measured. */
  run: number;
  cp: number;
  /** The glyph's own size, which small caps sets below its run's. */
  fontSize: number;
  /** The size it holds its line at: its run's, or the larger size a shrunken
   *  run inherited. */
  lineSize: number;
  /** How far its run is raised off the line's baseline. */
  baselineShift: number;
  /** UTF-16 span of the source character it was drawn from. */
  srcIndex: number;
  srcEnd: number;
  clusterEnd: boolean;
  /** The tier serving the glyph, which is not its run's when the code point
   *  escalated, and that tier's metrics. */
  resolved: ResolveResult;
  metrics: GlyphMetrics;
  /** The atlas to sample and the glyph's record in it; null on the outline
   *  tier and for a slot with nothing to draw. */
  font: BmFont | null;
  glyph: BmFontChar | null;
  advance: number;
  /** Its run's `letterSpacing` when it closes a grapheme cluster, else 0. */
  tracking: number;
  /** The kerning gap between the entry before it and this one. A
   *  nonspacing mark has none, and the entry after it kerns against the
   *  mark's base. */
  kerningBefore: number;
  /** Set on a tab, whose `advance` is known only once its line is. */
  tab?: TabStop;
  /** See `LaidOutCell.drawsInk`. */
  drawsInk: boolean;
}

/**
 * Measure every code point of `runs`, in order. Kerning pairs across run
 * boundaries, in the left glyph's face and at its size, and through a
 * nonspacing mark. A run whose face has
 * no metrics contributes no entries but still takes up its source offsets.
 *
 * With `pool`, the entries are its objects, rewritten in place and grown as
 * needed, so a caller that is done with them before it measures again
 * allocates none: the entries of a label re-laid out every frame were a tenth
 * of a HUD readout's garbage. They are then valid only until the next call
 * given the same pool. A pool keeps at most `POOL_MAX` of them.
 */
export function measureRuns(runs: readonly ResolvedRun[], tabSize: number, pool?: Entry[]): Entry[] {
  const entries: Entry[] = [];
  /** The entry the next one kerns against; none across a break, a tab, or a
   *  run with no metrics. */
  let prev: Entry | undefined;
  let srcIndex = 0;

  runs.forEach((run, runIndex) => {
    const resolved = resolveFontVariant(run.fontFamily, run.fontWeight, run.fontStyle);
    const metrics = metricsOf(resolved);
    if (!metrics) {
      // Laying out as nothing is indistinguishable from empty text downstream,
      // so this is the only signal a consumer ever gets.
      warnNoMetrics(run.fontFamily, run.fontWeight, run.fontStyle);
      srcIndex += run.srcMap?.length ?? run.text.length;
      prev = undefined;
      return;
    }
    const runBase = srcIndex;
    const map = run.srcMap;
    const clusterEnds = graphemeEnds(run.text);
    let cluster = 0;
    let clusterStart = 0;
    /** The color glyph of the cluster being walked, when it has one. */
    let color: ResolvedGlyph | null = null;
    let at = 0;

    for (const ch of run.text) {
      const cp = ch.codePointAt(0)!;
      const fontSize = run.sizeMap ? run.sizeMap[at] : run.fontSize;
      if (at === clusterStart) {
        color = resolveColorCluster(
          resolved, run.fontFamily, run.fontWeight, run.fontStyle, run.text.slice(at, clusterEnds[cluster]),
        );
      }
      const clusterEnd = at + ch.length === clusterEnds[cluster];
      if (clusterEnd) clusterStart = clusterEnds[cluster++];
      // World units, deliberately not scaled by fontSize: the same tracking
      // opens the same gap whatever size the run is set at.
      const tracking = clusterEnd ? run.letterSpacing : 0;
      // A transformed run draws characters its source does not have; each
      // takes the source span of the character it was mapped from.
      const srcStart = map ? runBase + map.starts[at] : runBase + at;
      const srcEnd = map ? runBase + map.ends[at] : runBase + at + ch.length;
      at += ch.length;
      srcIndex = map ? runBase + map.length : srcEnd;

      const mark = NONSPACING_MARK.test(ch);
      const kerningBefore = prev && !mark
        ? prev.metrics.kernOf(prev.cp, cp) * (prev.fontSize / prev.metrics.size)
        : 0;
      // A slot with nothing in it: no glyph, no width, and none of the
      // tracking or kerning a width would carry. Filled in place when it inks.
      const blank = blankEntry(
        pool, entries.length, runIndex, cp, fontSize, Math.max(run.fontSize, run.strutSize ?? 0),
        // Optional on the authored run type; absent, every y would go NaN.
        run.baselineShift ?? 0, srcStart, srcEnd, clusterEnd, resolved, metrics,
      );

      if (color) {
        entries.push(clusterEnd ? ink(blank, color, 0, tracking) : blank);
        prev = undefined;
      } else if (isHardLineBreak(cp)) {
        entries.push(blank);
        prev = undefined;
      } else if (cp === 9 || cp === 32) {
        // A face with no space still gets one wide enough to part words.
        const space = metrics.advanceOf(32);
        const advance = space !== null ? space * (fontSize / metrics.size) : fontSize * 0.25;
        if (cp === 9) {
          entries.push({ ...blank, tab: { stop: tabSize * (advance + run.letterSpacing), min: advance / 2 } });
          prev = undefined;
        } else {
          // Its record in the run's own tier, for an atlas that draws one. It
          // never escalates: a face without a space still parts words.
          const own = glyphIn(resolved, 32);
          blank.font = own?.font ?? null;
          blank.glyph = own?.glyph ?? null;
          blank.advance = advance;
          blank.tracking = tracking;
          blank.kerningBefore = kerningBefore;
          prev = blank;
          entries.push(prev);
        }
      } else {
        const hit = resolveGlyph(resolved, run.fontFamily, run.fontWeight, run.fontStyle, cp);
        const entry = hit ? ink(blank, hit, kerningBefore, tracking) : blank;
        entries.push(entry);
        if (!mark) prev = entry;
      }
    }
  });
  return entries;
}

/** The most entries a pool keeps, so one long text does not hold its entries for good. */
const POOL_MAX = 4096;

/** An entry with nothing in it — no glyph, no width — as `pool[i]` rewritten, or a new one. */
function blankEntry(
  pool: Entry[] | undefined, i: number, run: number, cp: number, fontSize: number, lineSize: number,
  baselineShift: number, srcIndex: number, srcEnd: number, clusterEnd: boolean,
  resolved: ResolveResult, metrics: GlyphMetrics,
): Entry {
  const e = pool?.[i];
  if (!e) {
    const made: Entry = {
      run, cp, fontSize, lineSize, baselineShift, srcIndex, srcEnd, clusterEnd, resolved, metrics,
      font: null, glyph: null, advance: 0, tracking: 0, kerningBefore: 0, tab: undefined, drawsInk: false,
    };
    if (pool && i < POOL_MAX) pool[i] = made;
    return made;
  }
  e.run = run; e.cp = cp; e.fontSize = fontSize; e.lineSize = lineSize; e.baselineShift = baselineShift;
  e.srcIndex = srcIndex; e.srcEnd = srcEnd; e.clusterEnd = clusterEnd; e.resolved = resolved; e.metrics = metrics;
  e.font = null; e.glyph = null; e.advance = 0; e.tracking = 0; e.kerningBefore = 0; e.tab = undefined;
  e.drawsInk = false;
  return e;
}

/** Fill the empty slot `e` with `hit`, in place: one object a code point. An
 *  escalated code point is served in another tier's units, so its scale is its own. */
function ink(e: Entry, hit: ResolvedGlyph, kerning: number, tracking: number): Entry {
  e.resolved = hit.resolved;
  e.metrics = hit.metrics;
  e.font = hit.font;
  e.glyph = hit.glyph;
  e.advance = hit.advance * (e.fontSize / hit.metrics.size);
  e.tracking = tracking;
  e.kerningBefore = kerning;
  e.drawsInk = true;
  return e;
}

/**
 * One line's entries with each bracket in a right-to-left stretch painting as
 * its mirror (UAX #9 L4). `levels` holds the line's resolved level per entry.
 *
 * The outline tier reads the code point directly; the atlas tiers need the
 * other glyph looked up, which may come from another tier, and a face without
 * it keeps the unmirrored one. The advance stays the one the wrap measured.
 */
export function mirrorEntries(
  entries: readonly Entry[],
  levels: readonly number[],
  mirror: (cp: number) => number | null,
  runs: readonly ResolvedRun[],
): Entry[] {
  return entries.map((entry, pos) => {
    if (levels[pos] % 2 === 0) return entry;
    const cp = mirror(entry.cp);
    if (cp === null || cp === entry.cp) return entry;
    if (entry.font === null) return { ...entry, cp };
    const run = runs[entry.run];
    const hit = resolveGlyph(entry.resolved, run.fontFamily, run.fontWeight, run.fontStyle, cp, false);
    if (!hit) return entry;
    return { ...entry, cp, resolved: hit.resolved, metrics: hit.metrics, font: hit.font, glyph: hit.glyph };
  });
}
