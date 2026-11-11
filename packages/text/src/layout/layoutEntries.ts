/**
 * Runs measured code point by code point: which glyph serves each one, how
 * far it advances, and the kerning before it. Nothing here knows about lines.
 *
 * A grapheme cluster with emoji presentation is the exception to one glyph a
 * code point: where the canvas tier draws a color glyph for it, that glyph
 * sits in the slot of the cluster's closing code point, and the code points
 * before it are slots with nothing in them.
 *
 * A run a shaper shapes takes its glyphs from the shaping instead, a cluster
 * at a time (`shapedRuns.ts`), and its kerning is already in their advances.
 */
import {
  glyphIn, metricsOf, resolveColorCluster, cachedFontVariant, resolveGlyph, warnNoMetrics,
  type BmFont, type BmFontChar, type GlyphMetrics, type ResolvedGlyph, type ResolveResult,
} from '@weasel-js/font';
import { graphemeEnds } from '../measure/graphemes';
import type { ResolvedRun } from '../runs/resolveRuns';
import { isHardLineBreak } from './lineBreak/lineBreaks';
import { SOFT_HYPHEN } from './lineBreak/wrapLines';
import type { ShapedCluster, TextShaper } from './shaperSeam';
import { shapeRun, type ShapedSlot } from './shapedRuns';
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
  /** Its run's `rotate`, in degrees: how far the glyph turns about its pen. */
  rotate: number;
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
  /** What it draws when its run was shaped; null when it was not, and its
   *  glyph is the one its code point maps to. */
  shaped: ShapedCluster | null;
  /** See `LaidOutCell.drawsInk`. */
  drawsInk: boolean;
  /** On a soft hyphen, what it draws when a line wraps at it; null elsewhere,
   *  and where no tier has a hyphen. */
  hyphen: Hyphen | null;
}

/** The hyphen a soft hyphen draws at the end of a line the wrap ended there:
 *  the face's U+2010, else its U+002D, as CSS's `hyphens: manual` draws. */
export interface Hyphen {
  cp: number;
  resolved: ResolveResult;
  metrics: GlyphMetrics;
  font: BmFont | null;
  glyph: BmFontChar | null;
  /** World units, as `Entry.advance`. */
  advance: number;
  /** The kerning between the entry before the soft hyphen and the hyphen. */
  kerningBefore: number;
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
 * given the same pool. A pool keeps at most `POOL_MAX` of them. With `into`,
 * the list returned is that array, emptied and refilled.
 *
 * With `shaper`, a run whose face it can read is shaped, and its code points
 * draw what the shaping gave them.
 */
export function measureRuns(
  runs: readonly ResolvedRun[], tabSize: number, pool?: Entry[], into?: Entry[], shaper: TextShaper | null = null,
): Entry[] {
  const entries: Entry[] = into ?? [];
  // Written by index and cut to length once: `length = 0` drops the backing
  // store, so pushing after it reallocated the list every call.
  let n = 0;
  /** The entry the next one kerns against; none across a break, a tab, or a
   *  run with no metrics. */
  let prev: Entry | undefined;
  let srcIndex = 0;
  /** Where each run's drawn text opens in the runs' texts joined, and which
   *  offsets there close a cluster: a run boundary can fall inside one. */
  let drawnBase = 0;
  const joinedEnds = clusterEndsAcross(runs);

  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const run = runs[runIndex];
    const resolved = cachedFontVariant(run.fontFamily, run.fontWeight, run.fontStyle);
    const metrics = metricsOf(resolved);
    if (!metrics) {
      // Laying out as nothing is indistinguishable from empty text downstream,
      // so this is the only signal a consumer ever gets.
      warnNoMetrics(run.fontFamily, run.fontWeight, run.fontStyle);
      srcIndex += run.srcMap?.length ?? run.text.length;
      drawnBase += run.text.length;
      prev = undefined;
      continue;
    }
    const runBase = srcIndex;
    const map = run.srcMap;
    const clusterEnds = graphemeEnds(run.text, CLUSTER_ENDS);
    const shaped = shapeRun(run, resolved, shaper);
    let cluster = 0;
    let clusterStart = 0;
    /** The color glyph of the cluster being walked, when it has one. */
    let color: ResolvedGlyph | null = null;
    let at = 0;
    const text = run.text;

    while (at < text.length) {
      const cp = text.codePointAt(at)!;
      const len = cp > 0xffff ? 2 : 1;
      const slot = shaped?.[at];
      const fontSize = run.sizeMap ? run.sizeMap[at] : run.fontSize;
      if (at === clusterStart) {
        color = resolveColorCluster(
          resolved, run.fontFamily, run.fontWeight, run.fontStyle, run.text.slice(at, clusterEnds[cluster]),
        );
      }
      const runClusterEnd = at + len === clusterEnds[cluster];
      if (runClusterEnd) clusterStart = clusterEnds[cluster++];
      const clusterEnd = joinedEnds === null ? runClusterEnd : joinedEnds[drawnBase + at + len] === 1;
      // World units, deliberately not scaled by fontSize: the same tracking
      // opens the same gap whatever size the run is set at.
      const tracking = clusterEnd ? run.letterSpacing : 0;
      // A transformed run draws characters its source does not have; each
      // takes the source span of the character it was mapped from.
      const srcStart = map ? runBase + map.starts[at] : runBase + at;
      const srcEnd = map ? runBase + map.ends[at] : runBase + at + len;
      at += len;
      srcIndex = map ? runBase + map.length : srcEnd;

      const mark = isNonspacingMark(cp);
      const kerningBefore = prev && !mark
        ? prev.metrics.kernOf(prev.cp, cp) * (prev.fontSize / prev.metrics.size)
        : 0;
      // A slot with nothing in it: no glyph, no width, and none of the
      // tracking or kerning a width would carry. Filled in place when it inks.
      const blank = blankEntry(pool, n, runIndex, run, cp, fontSize, srcStart, srcEnd, clusterEnd, resolved, metrics);

      if (color) {
        if (runClusterEnd) {
          blank.tracking = tracking;
          ink(blank, color);
        }
        entries[n++] = blank;
        prev = undefined;
      } else if (isHardLineBreak(cp)) {
        entries[n++] = blank;
        prev = undefined;
      } else if (cp === SOFT_HYPHEN) {
        // Invisible on every tier, whatever glyph a face maps it to, until
        // its line is known; kerning reads through it.
        blank.tracking = tracking;
        blank.hyphen = hyphenFor(run, resolved, fontSize, prev);
        entries[n++] = blank;
      } else if (cp === 9 || cp === 32) {
        if (cp === 32) { blank.tracking = tracking; blank.kerningBefore = kerningBefore; }
        entries[n++] = whiteSpace(blank, run, resolved, metrics, tabSize);
        prev = cp === 32 ? blank : undefined;
      } else if (slot !== undefined) {
        blank.tracking = tracking;
        entries[n++] = shape(blank, slot);
        prev = undefined;
      } else {
        const hit = resolveGlyph(resolved, run.fontFamily, run.fontWeight, run.fontStyle, cp, true, HIT);
        if (hit) {
          blank.kerningBefore = kerningBefore;
          blank.tracking = tracking;
          ink(blank, hit);
        }
        entries[n++] = blank;
        if (!mark) prev = blank;
      }
    }
    drawnBase += text.length;
  }
  entries.length = n;
  return entries;
}

/** Per UTF-16 offset into the texts of `runs` joined, 1 where a grapheme
 *  cluster closes. Refilled for each measure that needs it. */
let JOINED_ENDS = new Uint8Array(64);

/** {@link JOINED_ENDS} for `runs`, or null when no run boundary can fall
 *  inside a cluster: one between two units below U+0300, other than a CR,
 *  never does, so each run's own clusters are the answer. */
function clusterEndsAcross(runs: readonly ResolvedRun[]): Uint8Array | null {
  let spans = false;
  let last = -1;
  for (let i = 0; i < runs.length && !spans; i++) {
    const t = runs[i].text;
    if (t.length === 0) continue;
    spans = last >= 0 && (last >= 0x300 || last === 13 || t.charCodeAt(0) >= 0x300);
    last = t.charCodeAt(t.length - 1);
  }
  if (!spans) return null;
  let joined = '';
  for (let i = 0; i < runs.length; i++) joined += runs[i].text;
  if (JOINED_ENDS.length < joined.length + 1) JOINED_ENDS = new Uint8Array(Math.max(joined.length + 1, JOINED_ENDS.length * 2));
  JOINED_ENDS.fill(0, 0, joined.length + 1);
  const ends = graphemeEnds(joined, CLUSTER_ENDS);
  for (let k = 0; k < ends.length; k++) JOINED_ENDS[ends[k]] = 1;
  return JOINED_ENDS;
}

/** No nonspacing mark sits below U+0300, so Latin text builds no string to ask. */
function isNonspacingMark(cp: number): boolean {
  return cp >= 0x300 && NONSPACING_MARK.test(String.fromCodePoint(cp));
}

/** The cluster ends of the run being measured, refilled for each. */
const CLUSTER_ENDS: number[] = [];

/** What `resolveGlyph` answers into, which `ink` copies out of at once. */
const HIT: ResolvedGlyph = { resolved: null as unknown as ResolveResult, metrics: null as unknown as GlyphMetrics, advance: 0, font: null, glyph: null };

/** The most entries a pool keeps, so one long text does not hold its entries for good. */
const POOL_MAX = 4096;

/** An entry with nothing in it — no glyph, no width — as `pool[i]` rewritten, or a new one.
 *  It reads `r`'s numbers itself: a fraction passed to a call V8 does not inline is boxed. */
function blankEntry(
  pool: Entry[] | undefined, i: number, run: number, r: ResolvedRun, cp: number, fontSize: number,
  srcIndex: number, srcEnd: number, clusterEnd: boolean, resolved: ResolveResult, metrics: GlyphMetrics,
): Entry {
  const lineSize = Math.max(r.fontSize, r.strutSize ?? 0);
  // Optional on the authored run type; absent, every y would go NaN.
  const baselineShift = r.baselineShift ?? 0;
  const rotate = r.rotate ?? 0;
  const e = pool?.[i];
  if (!e) {
    const made: Entry = {
      run, cp, fontSize, lineSize, baselineShift, rotate, srcIndex, srcEnd, clusterEnd, resolved, metrics,
      font: null, glyph: null, advance: 0, tracking: 0, kerningBefore: 0, tab: undefined, shaped: null,
      drawsInk: false, hyphen: null,
    };
    if (pool && i < POOL_MAX) pool[i] = made;
    return made;
  }
  e.run = run; e.cp = cp; e.fontSize = fontSize; e.lineSize = lineSize; e.baselineShift = baselineShift;
  e.rotate = rotate; e.srcIndex = srcIndex; e.srcEnd = srcEnd; e.clusterEnd = clusterEnd; e.resolved = resolved; e.metrics = metrics;
  e.font = null; e.glyph = null; e.advance = 0; e.tracking = 0; e.kerningBefore = 0; e.tab = undefined;
  e.shaped = null; e.drawsInk = false; e.hyphen = null;
  return e;
}

/** Fill the empty slot `e` with `hit`, in place: one object a code point. An
 *  escalated code point is served in another tier's units, so its scale is its
 *  own. Its tracking and kerning are the caller's to set. */
function ink(e: Entry, hit: ResolvedGlyph): void {
  e.resolved = hit.resolved;
  e.metrics = hit.metrics;
  e.font = hit.font;
  e.glyph = hit.glyph;
  e.advance = hit.advance * (e.fontSize / hit.metrics.size);
  e.drawsInk = true;
}

/** `e`, a tab or a space, filled in place, or a tab copied from it; a space's
 *  tracking and kerning are the caller's to set. A face with no space still
 *  gets one wide enough to part words. */
function whiteSpace(e: Entry, run: ResolvedRun, resolved: ResolveResult, metrics: GlyphMetrics, tabSize: number): Entry {
  const space = metrics.advanceOf(32);
  const advance = space !== null ? space * (e.fontSize / metrics.size) : e.fontSize * 0.25;
  if (e.cp === 9) return { ...e, tab: { stop: tabSize * (advance + run.letterSpacing), min: advance / 2 } };
  // Its record in the run's own tier, for an atlas that draws one. It
  // never escalates: a face without a space still parts words.
  const own = glyphIn(resolved, 32, HIT);
  e.font = own?.font ?? null;
  e.glyph = own?.glyph ?? null;
  e.advance = advance;
  return e;
}

/** The hyphen a soft hyphen in `run` draws when a line wraps at it, kerned
 *  against `prev`: in the run's own tier first, then the dynamic tier. */
function hyphenFor(run: ResolvedRun, resolved: ResolveResult, fontSize: number, prev: Entry | undefined): Hyphen | null {
  const { fontFamily: family, fontWeight: weight, fontStyle: style } = run;
  let cp = HYPHEN;
  let hit = glyphIn(resolved, cp);
  if (!hit) hit = glyphIn(resolved, cp = HYPHEN_MINUS);
  if (!hit) hit = resolveGlyph(resolved, family, weight, style, cp = HYPHEN, false);
  if (!hit) hit = resolveGlyph(resolved, family, weight, style, cp = HYPHEN_MINUS, false);
  if (!hit) return null;
  return {
    cp, resolved: hit.resolved, metrics: hit.metrics, font: hit.font, glyph: hit.glyph,
    advance: hit.advance * (fontSize / hit.metrics.size),
    kerningBefore: prev ? prev.metrics.kernOf(prev.cp, cp) * (prev.fontSize / prev.metrics.size) : 0,
  };
}

const HYPHEN = 0x2010;
const HYPHEN_MINUS = 0x2d;

/** `e`, a soft hyphen closing a line the wrap ended there, drawing its hyphen, in place. */
export function hyphenate(e: Entry, opensLine: boolean): void {
  const h = e.hyphen!;
  e.cp = h.cp; e.resolved = h.resolved; e.metrics = h.metrics; e.font = h.font; e.glyph = h.glyph;
  e.advance = h.advance; e.kerningBefore = opensLine ? 0 : h.kerningBefore; e.shaped = null; e.drawsInk = true;
}

/** Fill the empty slot `e` with what shaping gave its code point, in place. */
function shape(e: Entry, slot: ShapedSlot): Entry {
  e.shaped = slot.cluster;
  e.advance = slot.advance * e.fontSize;
  e.drawsInk = slot.cluster.d !== null;
  return e;
}

/**
 * One line's entries with each bracket in a right-to-left stretch painting as
 * its mirror (UAX #9 L4). `levels` holds the line's resolved level per entry.
 *
 * The outline tier reads the code point directly; the atlas tiers need the
 * other glyph looked up, which may come from another tier, and a face without
 * it keeps the unmirrored one. The advance stays the one the wrap measured.
 *
 * A shaped entry already shows the mirror when it was shaped right to left.
 * Where that disagrees with its level — a bracket shaped with the text on one
 * side of it and resolved to the direction of the other — it gives up its
 * shaped glyph for its code point's own.
 */
export function mirrorEntries(
  entries: readonly Entry[],
  levels: readonly number[],
  mirror: (cp: number) => number | null,
  runs: readonly ResolvedRun[],
): Entry[] {
  return entries.map((entry, pos) => {
    const odd = levels[pos] % 2 === 1;
    if (entry.shaped !== null && entry.shaped.rtl !== odd) {
      const flipped = mirror(entry.cp);
      if (flipped !== null && flipped !== entry.cp) entry = unshaped(entry, runs[entry.run]);
    }
    if (!odd) return entry;
    if (entry.shaped !== null) return entry;
    const cp = mirror(entry.cp);
    if (cp === null || cp === entry.cp) return entry;
    if (entry.font === null) return { ...entry, cp };
    const run = runs[entry.run];
    const hit = resolveGlyph(entry.resolved, run.fontFamily, run.fontWeight, run.fontStyle, cp, false);
    if (!hit) return entry;
    return { ...entry, cp, resolved: hit.resolved, metrics: hit.metrics, font: hit.font, glyph: hit.glyph };
  });
}

/** `entry` drawing its own code point's glyph rather than its shaped cluster: on an atlas, the
 *  glyph's record, which shaping left out. */
function unshaped(entry: Entry, run: ResolvedRun): Entry {
  if (entry.resolved.source === 'outline') return { ...entry, shaped: null };
  const hit = resolveGlyph(entry.resolved, run.fontFamily, run.fontWeight, run.fontStyle, entry.cp, false);
  return hit
    ? { ...entry, shaped: null, resolved: hit.resolved, metrics: hit.metrics, font: hit.font, glyph: hit.glyph }
    : { ...entry, shaped: null };
}
