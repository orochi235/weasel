/**
 * Runs-aware text layout: wraps `ResolvedRun[]` into lines and buckets the
 * glyphs so the renderer issues one draw call per atlas+color group.
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
 * shift moves the run's glyphs, its outline geometry, and its own decoration
 * rules together, and does not feed back into the line's baseline or its height.
 *
 * Underline, strikethrough, and overline come out on a second channel,
 * `decorations`, as solid rectangles. They are accumulated during the pen walk
 * that emits quads, *not* reconstructed from quad extents afterwards: quads
 * exist only for glyphs with ink, so a decorated span's spaces would punch
 * holes in a rule derived from them.
 *
 * Every coordinate out of here is measured from the text's own top-left: the
 * caller translates. That is what lets a text node be dragged without
 * re-laying out.
 */

import { isSolidPaint, type Paint, type Stroke, type Fill } from '@weasel-js/paint';
import {
  resolveFontVariant, resolveGlyphFallback, glyphOutline, fontPending, faceMetricsOf,
  type ResolveResult, type BmFontChar, type BmFont, type FontStyle, type FaceMetrics,
} from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import { resolveAlign, type TextAlign, type TextDirection } from '../textStyle';
import type { BidiResolver } from './bidiSeam';
import { analyzeParagraphs, restoreRemoved } from './bidiLines';
import { directionOfLevel, registeredBidi } from './bidiRegistry';
import { refId } from './refId';
import { DECORATION_KINDS, decorationRule, type DecorationKind } from './decorationMetrics';
import { graphemeEnds } from '../measure/graphemes';
import { isHardLineBreak } from './lineBreak/lineBreaks';
import { wrapLines } from './lineBreak/wrapLines';
import { DEFAULT_TAB_SIZE, tabAdvance, widthWithTabs, type TabStop } from './tabStops';

/** One textured glyph quad, origin-relative — see the header. */
export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
  /** Y coordinate of the line's baseline (penY at quad emission). Used by the
   *  synthetic-italic vertex skew so above-baseline vertices lean right. */
  baselineY: number;
}

/**
 * One glyph the renderer should tessellate rather than sample.
 *
 * `d` is em-space SVG path data — 1 unit is 1 em, y grows down, origin on the
 * baseline at the pen. Placing it is therefore a uniform scale by `scale`
 * followed by a translate to `(x, baselineY)`. `key` identifies the cached
 * tessellation — face identity plus codepoint.
 */
export interface LaidOutOutlineGlyph {
  d: string;
  key: string;
  /** Pen position: where em-space x = 0 lands, in world units. */
  x: number;
  /** The line's baseline: where em-space y = 0 lands, in world units. */
  baselineY: number;
  /** World units per em — the run's `fontSize`, since em space is unit-scale. */
  scale: number;
}

/** Glyphs that share a resolved face, glyph source and paint — one draw call's worth. */
export interface LaidOutGroup {
  /** Resolved atlas family — may differ from the requested family when the
   *  cross-family fallback policy substituted a default. */
  family: string;
  /** Resolved variant — matches the registered atlas and the texture-cache key. */
  weight: number;
  style: FontStyle;
  /** Gap between the request and the resolved match. Drives shader uniforms. */
  synthetic: { bold: boolean; italic: boolean };
  /** Which glyph source (and therefore shader/texture) this group binds:
   *  baked MSDF atlas, the runtime canvas-SDF dynamic atlas, or tessellated
   *  font outlines. */
  source: 'atlas' | 'canvas' | 'outline';
  /** Dynamic-atlas page index for 'canvas' groups; 0 for the others. */
  page: number;
  /** `null` for an unfilled run: the group's glyphs are painted by `stroke`
   *  alone. Only ever null on an `'outline'` group carrying a stroke, since
   *  nothing else can put ink down without a fill. */
  fill: Fill | null;
  /** Outline painted over the glyphs. Only ever set on an `'outline'` group —
   *  the SDF tiers have no geometry to stroke, which is why a stroke pulls its
   *  run onto the outline tier at any size. A run the tier cannot serve at all
   *  (no registered outlines, synthetic bold) stays on the atlas, unstroked. */
  stroke?: Stroke;
  /** Textured glyph quads. Always empty for an `'outline'` group. */
  quads: LaidOutQuad[];
  /** Outline geometry. Always empty for an `'atlas'` / `'canvas'` group:
   *  the group is also the draw call, and one draw call binds one program. */
  glyphs: LaidOutOutlineGlyph[];
}

/**
 * One decoration rule: an axis-aligned solid rectangle in the same world
 * space as `LaidOutQuad`. Never spans a line break, and carries the fill of
 * the run(s) it decorates so the rule follows the text color.
 */
export interface LaidOutDecoration {
  kind: DecorationKind;
  x0: number; y0: number; x1: number; y1: number;
  fill: Fill;
}

/**
 * One advance cell: a single code point's slot on a line.
 *
 * A cell spans its code point *plus* the kerning that precedes the next one,
 * so a caret snapped to the midpoint between two `x`s lands where the glyphs
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
  /** Left edge of the cell, post-alignment, origin-relative like `x0`/`x1`.
   *
   *  **Not monotonic across `cells`** once a bidi engine reorders a line: cells
   *  stay in logical order and their x values do not. Sort on `x` for visual
   *  order; never assume `cells[i + 1].x` is this cell's right edge. */
  x: number;
  /** Width of the cell: its glyph's advance, plus its run's tracking when it
   *  closes a grapheme cluster, plus a justified gap's share of the slack. */
  advance: number;
  /** Resolved bidi embedding level — even reads left-to-right. 0 with no
   *  engine, which is the same as saying the text was laid out logically. */
  level: number;
  /**
   * Whether this code point can put ink on the page. False for a space and
   * for a code point no tier could serve — each of which still holds its
   * slot. A zero-advance combining mark is `true`: it inks without advancing.
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
 * One laid-out line's box, in the same world space as `LaidOutQuad`.
 *
 * `[x0, x1]` is the line's own advance width *after* alignment — not the
 * wrap box — so a short centered line reports the span it actually occupies.
 * `[y0, y1]` is the full line box: `y0` is the pen's line top, `y1` is
 * `y0 + max(fontSize * lineHeight)` over the line's runs. Ink can escape it
 * vertically; this is the typographic box, not an ink bounding box.
 *
 * Emitted for every line including empty ones, so indices line up with the
 * wrap. An empty line has `x0 === x1`.
 */
export interface LaidOutLineBox {
  x0: number; y0: number; x1: number; y1: number;
  /** The line's baseline, for callers placing carets or rules against it. */
  baselineY: number;
  /**
   * One cell per code point on this line, left to right. Every code point the
   * line covers has exactly one, drawn or not; only a newline has none, since
   * it separates cells rather than being one. The code points are the drawn
   * ones, after `textTransform`, so an uppercased `ß` has two cells.
   *
   * A caret stop is a cell's `x`, and the stop closing the line is `x1` /
   * `srcEnd` — there is one more stop than cell, except that cells sharing a
   * source span have no stop between them.
   */
  cells: LaidOutCell[];
  /**
   * Source offset just past this line's last cell — the closing caret stop's
   * index, and the only source offset a blank line carries.
   */
  srcEnd: number;
}

/** What {@link layoutRuns} returns. Every coordinate is relative to the text's own top-left. */
export interface LaidOutRuns {
  groups: LaidOutGroup[];
  /** Decoration rules, in line order; within a span, underline then
   *  strikethrough then overline. Empty when nothing is decorated. */
  decorations: LaidOutDecoration[];
  /** Per-line boxes in layout order: where the text actually sits inside its
   *  wrap box. */
  lines: LaidOutLineBox[];
  /** The text's ink box. `width` is the widest line measured to its last
   *  non-space cell — a trailing space hangs past the aligned edge, so a
   *  block wrapped at `maxWidth` never reports wider than it. */
  bounds: { width: number; height: number };
}

/**
 * Where a run's advances, kerning and baseline come from.
 *
 * The two tiers that carry metrics express them in different units — a baked
 * atlas in its own bake-size units, a parsed face in ems. `size` is the divisor
 * that takes either into world units (`fontSize / size`), which is why an
 * em-space face reports `size: 1`.
 */
interface MetricsSource {
  /** Units per em of whatever `advance`, `base` and `kernOf` are measured in. */
  size: number;
  /** Line top to baseline in the glyph frame, in those same units: what an
   *  atlas glyph's `yoffset` is measured against. */
  base: number;
  /** Baseline to the top and bottom of the face's line box, in those same
   *  units — the ascent and descent a browser sets the face with. `descent`
   *  is absent for a face that states neither, which hangs its baseline
   *  `base` below the line top instead of centering the face in the line. */
  ascent: number;
  descent?: number;
  /** Advance for `cp`, or null when this source has no glyph for it. */
  advanceOf(cp: number): number | null;
  kernOf(left: number, right: number): number;
}

function atlasMetrics(font: BmFont): MetricsSource {
  const size = font.info.size;
  const { ascent, descent } = font.faceMetrics ?? {};
  return {
    size,
    base: font.common.base,
    ...(ascent !== undefined && descent !== undefined
      ? { ascent: ascent * size, descent: descent * size }
      : { ascent: font.common.base }),
    advanceOf: (cp) => font.charMap.get(cp)?.xadvance ?? null,
    kernOf: (l, r) => font.kerningMap.get(l)?.get(r) ?? 0,
  };
}

/** Options for {@link layoutRuns}. */
export interface LayoutRunsOpts {
  /** Wrap width. `Infinity` never wraps. */
  maxWidth: number;
  /**
   * Width of the box `center` / `right` resolve within, with `x = 0` its left
   * edge. Default `maxWidth`. Separate from it so a box can align text it does
   * not wrap. When both are infinite a line anchors on its own width instead:
   * `x = 0` is its midpoint (`center`) or right edge (`right`).
   */
  alignWidth?: number;
  lineHeight: number;
  /**
   * `start` / `end` resolve against `direction`; `left` / `right` are absolute
   * and ignore it, the way CSS `text-align` treats the same values. `justify`
   * is `justify: true` with the start edge.
   */
  align: TextAlign;
  /**
   * Spread each line that wrapped across `alignWidth`, widening its word gaps
   * (spaces between words; not leading or hanging trailing ones) by equal
   * shares of the slack. A line that closes its paragraph, or has no gap, or
   * no slack, keeps `align` — so `align` is CSS `text-align-last` here.
   * Implied by `align: 'justify'`. Default `false`.
   */
  justify?: boolean;
  /**
   * Bidi engine. Default: the one given to `registerBidi`. With neither, the
   * text lays out in logical order, which is correct for left-to-right text
   * and wrong for right-to-left text — see the warning this emits when it
   * detects the latter without one.
   */
  bidi?: BidiResolver;
  /**
   * Reading direction: the base direction of the bidi analysis, and what
   * `start` / `end` resolve against. Default `'auto'`, each paragraph's own
   * first strong character, which only an engine can find: with none, `'auto'`
   * reads left to right.
   */
  direction?: TextDirection | 'auto';
  /**
   * Distance between tab stops, in spaces of the tab's own run (its advance
   * plus the run's tracking), as CSS `tab-size` counts it. A tab advances to
   * the next stop from the start of its line. Default 8.
   */
  tabSize?: number;
  /**
   * World-space `fontSize` at or above which glyphs are emitted as outline
   * geometry, when the resolved face has outlines registered. Omit (the
   * default) to keep every glyph on its SDF tier.
   *
   * This is a rendering switch only. Advances, kerning, wrapping, and
   * baselines are identical either way, so measurement callers leave it unset
   * and still agree with the paint, and crossing the threshold cannot reflow
   * text.
   *
   * Ignored for a family that resolved to the outline tier because it has no
   * atlas: there the geometry is the only rendering.
   */
  outlineMinSize?: number;
}

interface LayoutContext {
  groups: Map<string, LaidOutGroup>;
}

function fillKey(p: Paint | null): string {
  if (p === null) return 'none';
  if (isSolidPaint(p)) return `s:${p.color}:${p.opacity ?? 1}`;
  return `nx:${refId(p)}`;
}

/**
 * Whether two runs' fills paint the same, for merging their decoration rules.
 * Solid paints compare by value; anything else compares by reference, because
 * a false positive would paint one run's rule with another's paint.
 */
function sameFill(a: Paint | null, b: Paint | null): boolean {
  if (a === b) return true;
  if (isSolidPaint(a) && isSolidPaint(b)) {
    return a.color === b.color && (a.opacity ?? 1) === (b.opacity ?? 1);
  }
  return false;
}

/** Whether a stroke puts ink down — an omitted, unpainted, or zero-width one
 *  does not, and must not pull a run onto the outline tier for nothing. */
function strokePaints(s: Stroke | undefined): s is Stroke & { paint: Paint } {
  if (s?.paint === undefined) return false;
  const w = s.width ?? 1;
  return (typeof w === 'number' ? w : w.px) > 0;
}

/**
 * Draw state for a stroke, for grouping. Two runs stroked the same way share
 * a draw call; anything else has to split, since the group *is* the draw call
 * and one call paints one ribbon.
 */
function strokeKey(s: Stroke | undefined): string {
  if (!strokePaints(s)) return '-';
  const width = s.width ?? 1;
  return [
    // A screen-pixel width keys apart from the equal world-unit number: the two
    // resolve to different ribbons, so they must not share a draw call.
    fillKey(s.paint), typeof width === 'number' ? width : `px${width.px}`,
    s.join ?? 'miter', s.cap ?? 'butt',
    s.miterLimit ?? '', s.align ?? 'center', (s.dash ?? []).join(','),
  ].join(':');
}

function groupKey(
  family: string,
  weight: number,
  style: FontStyle,
  synthetic: { bold: boolean; italic: boolean },
  fill: Paint | null,
  stroke: Stroke | undefined,
  source: 'atlas' | 'canvas' | 'outline',
  page: number,
): string {
  return `${family}|${weight}|${style}|${synthetic.bold ? 1 : 0}${synthetic.italic ? 1 : 0}|${fillKey(fill)}|${strokeKey(stroke)}|${source}|${page}`;
}

/**
 * `source` overrides the tier the resolver picked. Passed for outline glyphs,
 * which are served by a face the *resolver* still reports as atlas or canvas
 * — the tier decision for a glyph is made per glyph, not per run
 * — and which must not share a draw call with the quads around them.
 */
function getOrCreateGroup(
  ctx: LayoutContext,
  run: ResolvedRun,
  resolved: ResolveResult,
  page: number,
  sourceOverride?: 'outline',
): LaidOutGroup {
  // The *resolved* family, not the requested one. The renderer looks this up
  // with an exact `getFont`, so a group tagged with a family that has no atlas
  // uploads no texture and draws no quads.
  const atlasFamily = resolved.resolved.family;
  const resolvedWeight = resolved.resolved.weight;
  const resolvedStyle = resolved.resolved.style;
  const source = sourceOverride ?? resolved.source;
  const key = groupKey(
    atlasFamily,
    resolvedWeight,
    resolvedStyle,
    resolved.synthetic,
    (run.fill?.paint ?? null),
    source === 'outline' && strokePaints(run.stroke) ? run.stroke : undefined,
    source,
    page,
  );
  let g = ctx.groups.get(key);
  if (!g) {
    g = {
      family: atlasFamily,
      weight: resolvedWeight,
      style: resolvedStyle,
      synthetic: { ...resolved.synthetic },
      source,
      page,
      fill: run.fill,
      // Only the outline tier can paint it, and carrying it on an SDF group
      // would be a promise the renderer cannot keep.
      ...(source === 'outline' && strokePaints(run.stroke) ? { stroke: run.stroke } : {}),
      quads: [],
      glyphs: [],
    };
    ctx.groups.set(key, g);
  }
  return g;
}

/**
 * A glyph, plus which tier ended up serving it. `resolved`/`font` differ from
 * the run's own when a codepoint escalated to the dynamic tier — the caller
 * has to carry both, because they pick the group (shader, texture, page) and
 * the scale divisor (`font.info.size`).
 */
interface GlyphHit {
  glyph: BmFontChar;
  font: BmFont;
  resolved: ResolveResult;
}

/**
 * Find a glyph for `cp`: the atlas, then the dynamic tier, then nothing — with
 * a warning naming the codepoint. A miss never draws a stand-in `?`, which is
 * indistinguishable from one the author wrote, and the BmFont atlas format has
 * no `.notdef` to draw.
 */
function resolveGlyph(
  run: ResolvedRun,
  font: BmFont | null,
  resolved: ResolveResult,
  cp: number,
  warn = true,
): GlyphHit | null {
  const direct = font?.charMap.get(cp);
  if (font && direct) return { glyph: direct, font, resolved };

  const fallback = resolveGlyphFallback(run.fontFamily, run.fontWeight, run.fontStyle);
  const face = fallback?.dynamicFace;
  if (fallback && face) {
    const glyph = face.requestGlyph(cp);
    // A face that can't measure the codepoint reports a zero advance and no
    // ink — nothing worth switching groups for, so fall through to the warn.
    if (glyph.xadvance > 0 || glyph.width > 0) {
      return { glyph, font: face.font, resolved: fallback };
    }
  }

  if (warn) warnMissingGlyphOnce(resolved.resolved.family, cp);
  return null;
}

/**
 * Code point blocks whose strong characters read right-to-left.
 *
 * A heuristic on purpose: the real answer is `Bidi_Class`, which lives in
 * `@weasel-js/bidi` and is exactly what the caller has not installed when this
 * matters. Every range here is wholly right-to-left, so it can miss a script
 * but never accuse a left-to-right one.
 */
const RTL_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x0590, 0x05ff], [0x0600, 0x07bf], [0x0860, 0x08ff],
  [0xfb1d, 0xfdff], [0xfe70, 0xfeff],
  [0x10800, 0x10fff], [0x1e800, 0x1efff],
];

let warnedLogicalRtl = false;

function warnLogicalRtlOnce(): void {
  if (warnedLogicalRtl) return;
  warnedLogicalRtl = true;
  console.warn(
    // Naming the import in `from "<pkg>"` form would trip labkit's
    // consumer smoke test, which greps dist for that exact shape.
    'weasel layoutRuns: this text contains right-to-left characters but no ' +
    '`bidi` engine is registered, so it is being laid out in logical order — ' +
    'the glyphs will appear reversed. Import `bidi` out of the ' +
    '`@weasel-js/bidi` package and call `registerBidi(bidi)` once at startup.',
  );
}

/** @internal Test seam — the warning fires once per process otherwise. */
export function _resetBidiWarningForTests(): void {
  warnedLogicalRtl = false;
}

const warnedMissingGlyphs = new Set<string>();

function warnMissingGlyphOnce(family: string, cp: number): void {
  const key = `${family}|${cp}`;
  if (warnedMissingGlyphs.has(key)) return;
  warnedMissingGlyphs.add(key);
  const ch = String.fromCodePoint(cp);
  console.warn(
    `weasel layoutRuns: no glyph for U+${cp.toString(16).toUpperCase().padStart(4, '0')} ` +
    `(${JSON.stringify(ch)}) in "${family}", and the dynamic tier could not ` +
    `rasterize it — skipping the character. Bake it into the atlas, or call ` +
    `registerCanvasFont("${family}") to serve missing codepoints from ` +
    `installed fonts.`,
  );
}

/** @internal Test seam — the warn-once keys are module state. */
export function _resetMissingGlyphWarningsForTests(): void {
  warnedMissingGlyphs.clear();
}

const warnedNoMetrics = new Set<string>();

function warnNoMetricsOnce(family: string, weight: number, style: string): void {
  const key = `${family}|${weight}|${style}`;
  if (warnedNoMetrics.has(key)) return;
  warnedNoMetrics.add(key);
  console.warn(
    `weasel layoutRuns: no metrics for "${family}" ${weight}/${style} — neither ` +
    `an atlas nor an outline face resolved, so every run set in it lays out as ` +
    `nothing. Register it with registerFont / registerCanvasFont / ` +
    `registerFontOutlines. If you did, check for a duplicated @weasel-js/font in ` +
    `node_modules — its registry is module state, so a second copy is a second, ` +
    `empty one.`,
  );
}

/** @internal Test seam — the warn-once keys are module state. */
export function _resetNoMetricsWarningsForTests(): void {
  warnedNoMetrics.clear();
}

/**
 * Lay out `runs` into draw groups, decoration rules and line boxes. Wrapping,
 * baselines, tracking and decorations follow the rules in this file's module doc.
 */
export function layoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
): LaidOutRuns {
  const ctx: LayoutContext = { groups: new Map() };
  const bidi = opts.bidi ?? registeredBidi();
  const direction = opts.direction ?? 'auto';
  const justify = opts.justify === true || opts.align === 'justify';
  const tabSize = opts.tabSize ?? DEFAULT_TAB_SIZE;

  // Per-glyph entry produced by walking runs codepoint-by-codepoint.
  // Position (x) is filled in during the line-fitting pass.
  interface Entry {
    run: ResolvedRun;
    /** The atlas to sample, or null on the outline tier, which has none. */
    font: BmFont | null;
    metrics: MetricsSource;
    glyph: BmFontChar | null;
    cp: number;
    advance: number;         // xadvance in world units (already scaled)
    tracking: number;        // run letterSpacing if this closes a cluster, else 0 (world units)
    kerningBefore: number;   // kerning gap consumed before this glyph
    isSpace: boolean;
    /** Set on a tab, whose `advance` is filled in once its line is known. */
    tab?: TabStop;
    isNewline: boolean;
    /** Whether this code point can put ink on the page — see `LaidOutCell`. */
    drawsInk: boolean;
    resolved: ResolveResult;
    fontSize: number;
    /** UTF-16 offset of this code point in the runs' concatenated text. */
    srcIndex: number;
    /** One past it — `srcIndex + 2` for an astral code point. */
    srcEnd: number;
    /** Position in the flat entry list, which is what the bidi engine indexes.
     *  Survives the wrap's copies, unlike object identity. */
    flat: number;
  }
  /** The size an entry holds its line at — its run's, or the larger size a
   *  shrunken run inherited. Glyphs are drawn at their own `fontSize`
   *  regardless, which small caps sets below the run's. */
  const lineSize = (e: Entry): number => Math.max(e.run.fontSize, e.run.strutSize ?? 0);
  /**
   * How far above the baseline an entry's inline box reaches, CSS's way: the
   * face's ascent plus half the leading its line height leaves around ascent
   * and descent. A face taller than its line box gets negative leading and
   * overflows the box rather than growing it — the box stays `lineHeight`
   * tall either way.
   */
  const aboveBaseline = (e: Entry): number => {
    const k = lineSize(e) / e.metrics.size;
    const ascent = e.metrics.ascent * k;
    if (e.metrics.descent === undefined) return ascent;
    return (lineSize(e) * opts.lineHeight - ascent - e.metrics.descent * k) / 2 + ascent;
  };

  // 1. Flatten all runs into entries with per-glyph data, computing
  //    kerning using the left glyph's atlas+scale across run boundaries.
  const entries: Entry[] = [];
  /** Per entry, in step with `entries`: whether it closes a grapheme cluster. */
  const closesCluster: boolean[] = [];
  /** Each run's own face, which places its rules. Kept per run rather than
   *  read off an entry, whose `resolved` may be a per-glyph fallback. */
  const runFaces = new Map<ResolvedRun, FaceMetrics | undefined>();
  let prevCp: number | undefined;
  let prevMetrics: MetricsSource | undefined;
  let prevFontSize: number | undefined;
  let srcIndex = 0;

  for (const run of runs) {
    const resolved = resolveFontVariant(run.fontFamily, run.fontWeight, run.fontStyle);
    runFaces.set(run, faceMetricsOf(resolved));
    const outlineFace = resolved.outlineFace;
    const font = resolved.entry?.font ?? resolved.dynamicFace?.font ?? null;
    // Em space is unit-scale, so a parsed face divides by 1 and its advances
    // are already the world-unit fractions of `fontSize` layout wants.
    const metrics: MetricsSource | undefined = outlineFace
      ? {
        size: 1,
        base: outlineFace.ascender,
        ascent: outlineFace.faceMetrics?.ascent ?? outlineFace.ascender,
        ...(outlineFace.faceMetrics?.descent !== undefined ? { descent: outlineFace.faceMetrics.descent } : {}),
        advanceOf: (cp) => outlineFace.advanceOf(cp),
        kernOf: (l, r) => outlineFace.kernOf(l, r),
      }
      : font ? atlasMetrics(font) : undefined;
    if (!metrics) {
      // A run with no metrics lays out as nothing, which is indistinguishable
      // from empty text downstream — the only signal a consumer ever gets.
      // A late face is not a missing one: the settle relayouts and asks again.
      if (!fontPending(run.fontFamily, run.fontWeight, run.fontStyle)) {
        warnNoMetricsOnce(run.fontFamily, run.fontWeight, run.fontStyle);
      }
      // Skipped, but its characters still occupy source offsets — dropping
      // them here would shift every later run's caret indices left.
      srcIndex += run.srcMap?.length ?? run.text.length;
      prevCp = undefined; prevMetrics = undefined; prevFontSize = undefined;
      continue;
    }
    const runBase = srcIndex;
    const map = run.srcMap;
    const sizes = run.sizeMap;
    let at = 0;
    // World units — deliberately not scaled by fontSize, so the same tracking
    // opens the same visual gap whatever size the run is set at.
    const runTracking = run.letterSpacing;
    const clusterEnds = new Set(graphemeEnds(run.text));

    for (const ch of [...run.text]) {
      const cp = ch.codePointAt(0)!;
      // Small caps sizes glyphs within the run, so the size is the glyph's.
      const fontSize = sizes ? sizes[at] : run.fontSize;
      const scale = fontSize / metrics.size;
      const clusterEnd = clusterEnds.has(at + ch.length);
      closesCluster.push(clusterEnd);
      const tracking = clusterEnd ? runTracking : 0;
      const isNewline = isHardLineBreak(cp);
      const isSpace = cp === 32;
      // A transformed run draws characters its source does not have; each
      // one takes the source span of the character it was mapped from.
      const srcStart = map ? runBase + map.starts[at] : runBase + at;
      const srcEnd = map ? runBase + map.ends[at] : runBase + at + ch.length;
      at += ch.length;
      srcIndex = map ? runBase + map.length : srcEnd;

      if (isNewline) {
        entries.push({
          run, font, metrics,
          glyph: { id: cp, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
          // A newline consumes no advance, so it takes no tracking either.
          cp, advance: 0, tracking: 0, kerningBefore: 0, isSpace: false, isNewline: true,
          drawsInk: false,
          resolved, fontSize: fontSize, srcIndex: srcStart, srcEnd, flat: 0,
        });
        prevCp = undefined; prevMetrics = undefined; prevFontSize = undefined;
        continue;
      }

      const isTab = cp === 9;
      if (isSpace || isTab) {
        // Use atlas glyph if present; otherwise synthesize a zero-size entry
        // with a reasonable advance so spaces still participate in line-fitting.
        const spaceGlyph = resolved.dynamicFace ? resolved.dynamicFace.requestGlyph(32) : font?.charMap.get(32) ?? null;
        const spaceAdvance = spaceGlyph ? spaceGlyph.xadvance : metrics.advanceOf(32);
        const advance = spaceAdvance !== null
          ? spaceAdvance * scale
          : fontSize * 0.25;
        if (isTab) {
          entries.push({
            run, font, metrics,
            glyph: { id: cp, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
            cp, advance: 0, tracking: 0, kerningBefore: 0, isSpace: false, isNewline: false,
            tab: { stop: tabSize * (advance + runTracking), min: advance / 2 },
            drawsInk: false,
            resolved, fontSize: fontSize, srcIndex: srcStart, srcEnd, flat: 0,
          });
          prevCp = undefined; prevMetrics = undefined; prevFontSize = undefined;
          continue;
        }
        let kerningBefore = 0;
        if (prevCp !== undefined && prevMetrics !== undefined && prevFontSize !== undefined) {
          kerningBefore = prevMetrics.kernOf(prevCp, cp) * (prevFontSize / prevMetrics.size);
        }
        entries.push({
          run, font, metrics,
          glyph: spaceGlyph ?? { id: 32, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
          cp, advance, tracking, kerningBefore, isSpace: true, isNewline: false,
          drawsInk: false,
          resolved, fontSize: fontSize, srcIndex: srcStart, srcEnd, flat: 0,
        });
        prevCp = cp; prevMetrics = metrics; prevFontSize = fontSize;
        continue;
      }

      // An outline-only face has no atlas to miss in, and its advance is the
      // only thing needed to place a glyph it has. One it lacks escalates
      // below, as an atlas miss does.
      const adv = outlineFace ? metrics.advanceOf(cp) : null;
      if (adv !== null) {
        let kerningBefore = 0;
        if (prevCp !== undefined && prevMetrics !== undefined && prevFontSize !== undefined) {
          kerningBefore = prevMetrics.kernOf(prevCp, cp) * (prevFontSize / prevMetrics.size);
        }
        entries.push({
          run, font: null, metrics, glyph: null, cp,
          advance: adv * scale,
          tracking, kerningBefore, isSpace, isNewline: false, drawsInk: !isSpace,
          resolved, fontSize: fontSize, srcIndex: srcStart, srcEnd, flat: 0,
        });
        prevCp = cp; prevMetrics = metrics; prevFontSize = fontSize;
        continue;
      }

      const hit = resolved.dynamicFace
        ? { glyph: resolved.dynamicFace.requestGlyph(cp), font: font!, resolved }
        : resolveGlyph(run, font, resolved, cp);
      if (!hit) {
        entries.push({
          run, font: null, metrics, glyph: null, cp,
          advance: 0, tracking: 0, kerningBefore: 0, isSpace, isNewline: false,
          drawsInk: false,
          resolved, fontSize: fontSize, srcIndex: srcStart, srcEnd, flat: 0,
        });
        prevCp = cp; prevMetrics = metrics; prevFontSize = fontSize;
        continue;
      }
      // An escalated codepoint is served by a different atlas with its own
      // bake size, so its scale — and the group it lands in — are its own.
      const glyphFont = hit.font;
      const glyphMetrics = glyphFont === font ? metrics : atlasMetrics(glyphFont);
      const glyphScale = fontSize / glyphFont.info.size;

      let kerningBefore = 0;
      if (prevCp !== undefined && prevMetrics !== undefined && prevFontSize !== undefined) {
        kerningBefore = prevMetrics.kernOf(prevCp, cp) * (prevFontSize / prevMetrics.size);
      }

      entries.push({
        run, font: glyphFont, metrics: glyphMetrics, glyph: hit.glyph, cp,
        advance: hit.glyph.xadvance * glyphScale,
        tracking,
        kerningBefore,
        isSpace, isNewline: false, drawsInk: !isSpace,
        resolved: hit.resolved, fontSize: fontSize, srcIndex: srcStart, srcEnd, flat: 0,
      });

      prevCp = cp; prevMetrics = glyphMetrics; prevFontSize = fontSize;
    }
  }

  for (let i = 0; i < entries.length; i++) entries[i].flat = i;

  // Each paragraph is analyzed once; each line then asks for its own range,
  // because L1 resets trailing whitespace against a line's end.
  const paragraphs = bidi
    ? analyzeParagraphs(bidi, entries.map((e) => e.cp), (i) => entries[i].isNewline, direction)
    : null;
  if (!bidi
      && entries.some((e) => RTL_BLOCKS.some(([lo, hi]) => e.cp >= lo && e.cp <= hi))) {
    warnLogicalRtlOnce();
  }

  // 2. Break the entries into lines — at hard breaks, and at UAX #14
  //    opportunities when `maxWidth` is finite — then fill each one.
  interface Line {
    entries: Entry[];
    width: number;
    height: number;
    /** Set only for a line with no entries at all — the hard break that
     *  closed it, which is the only carrier of the style a blank line should
     *  take its height and baseline from. */
    blank?: Entry;
    /** Closed by the wrap rather than by a hard break or the end of the
     *  text — the lines `justify` spreads. */
    wrapped?: boolean;
  }

  // An entry opening a line drops the kerning before it.
  const openingWidth = (e: Entry): number => e.advance + e.tracking;
  /** `sum[k]`: width of entries `[0, k)` set end to end. */
  const sum = new Float64Array(entries.length + 1);
  for (let k = 0; k < entries.length; k++) {
    const e = entries[k];
    sum[k + 1] = sum[k] + e.kerningBefore + e.advance + e.tracking;
  }
  const flatWidth = (start: number, end: number): number =>
    openingWidth(entries[start]) + sum[end] - sum[start + 1];
  const tabs: number[] = [];
  entries.forEach((e, k) => { if (e.tab) tabs.push(k); });
  const widthOf = tabs.length === 0 ? flatWidth : (start: number, end: number): number =>
    widthWithTabs(start, end, tabs, (k) => entries[k].tab!, flatWidth);

  const lines: Line[] = [];
  for (const span of wrapLines(entries.map((e) => e.cp), opts.maxWidth, widthOf)) {
    const line: Line = { entries: [], width: 0, height: 0, ...(span.wrapped ? { wrapped: true } : {}) };
    if (span.start === span.end) {
      // A blank line still advances the pen, at the size of the break that
      // closed it, since no other entry can supply one.
      const brk = entries[span.end];
      line.height = lineSize(brk) * opts.lineHeight;
      line.blank = brk;
    }
    for (let k = span.start; k < span.end; k++) {
      const e = entries[k];
      const opened = k > span.start ? e : { ...e, kerningBefore: 0 };
      const placed = e.tab
        ? { ...opened, advance: tabAdvance(line.width, e.tab.stop, e.tab.min) }
        : opened;
      line.entries.push(placed);
      line.width += placed.kerningBefore + placed.advance + placed.tracking;
      line.height = Math.max(line.height, lineSize(e) * opts.lineHeight);
    }
    lines.push(line);
  }

  /**
   * Em-space outline for `e`, or `null` to leave it on its SDF tier.
   */
  function outlineFor(e: Entry): string | null {
    const r0 = e.resolved.resolved;
    // An outline-only run has no atlas behind it. Every gate below trades one
    // rendering for another; here there is no other, so gating would paint
    // nothing at all.
    if (e.resolved.source === 'outline') {
      return glyphOutline(r0.family, r0.weight, r0.style, e.cp);
    }
    const min = opts.outlineMinSize;
    if (min === undefined) return null;
    // A stroked run ignores the size gate: the SDF tiers have no geometry to
    // stroke, so leaving it below the threshold drops the outline asked for.
    // Gated on the run's size, so a small-caps word is not split across tiers.
    if (e.run.fontSize < min && !strokePaints(e.run.stroke)) return null;
    // Synthetic bold is an SDF threshold shift, and a path has no threshold.
    // Painting the regular weight instead would make text get *lighter* as
    // you zoom past the threshold. Synthetic italic is a shear, exact on
    // geometry, and the renderer applies it.
    if (e.resolved.synthetic.bold) return null;
    const r = e.resolved.resolved;
    return glyphOutline(r.family, r.weight, r.style, e.cp);
  }

  // 3. Lay out each line: apply alignment, then emit quads (and the
  //    decoration rules that span them).
  const decorations: LaidOutDecoration[] = [];

  /** An open decoration span: contiguous entries on one line that agree on
   *  which rules to draw, what color to draw them, and the metrics that set
   *  their placement. `x1` grows as the pen walks. */
  interface DecoSpan {
    underline: boolean;
    strikethrough: boolean;
    overline: boolean;
    fill: Fill;
    fontSize: number;
    face: FaceMetrics | undefined;
    baselineY: number;
    x0: number;
    x1: number;
  }
  let span: DecoSpan | null = null;

  function flushSpan(): void {
    const s = span;
    span = null;
    if (!s || s.x1 <= s.x0) return;
    for (const kind of DECORATION_KINDS) {
      if (!s[kind]) continue;
      const { y0, y1 } = decorationRule(kind, s.baselineY, s.fontSize, s.face);
      decorations.push({ kind, x0: s.x0, y0, x1: s.x1, y1, fill: s.fill });
    }
  }

  const lineBoxes: LaidOutLineBox[] = [];
  let penY = 0;
  let maxLineWidth = 0;
  const alignWidth = opts.alignWidth ?? opts.maxWidth;
  for (const line of lines) {
    // Trailing whitespace hangs: CSS aligns a line on its ink, so a line that
    // happens to end in a space sits where it would without one. The space
    // keeps its cell and its advance — it just hangs past the aligned edge.
    let hung = 0;
    for (let k = line.entries.length - 1; k >= 0; k--) {
      const e = line.entries[k];
      if (!e.isSpace && !e.tab) break;
      hung += e.kerningBefore + e.advance + e.tracking;
    }
    const inkWidth = line.width - hung;
    // Justification: the interior spaces, each widened by an equal share of
    // the slack. Leading spaces are zero-width slots and trailing ones hang,
    // so neither is a gap between words.
    const gaps = new Set<number>();
    let gapExtra = 0;
    if (justify && line.wrapped && Number.isFinite(alignWidth) && alignWidth > inkWidth) {
      let first = 0;
      while (first < line.entries.length && line.entries[first].isSpace) first++;
      let last = line.entries.length - 1;
      while (last > first && line.entries[last].isSpace) last--;
      for (let k = first + 1; k < last; k++) if (line.entries[k].isSpace) gaps.add(k);
      if (gaps.size > 0) gapExtra = (alignWidth - inkWidth) / gaps.size;
    }
    const spread = gapExtra * gaps.size;
    const align = resolveAlign(opts.align, direction !== 'auto' ? direction
      : directionOfLevel(line.entries.length > 0 ? paragraphs?.baseLevel(line.entries[0].flat) ?? 0 : 0));
    const alignShift = (() => {
      if (spread > 0) return 0;
      if (align === 'left') return 0;
      // The boxless anchor matches the canvas-2D `renderLabel` model, so
      // point-anchored labels center on x in both backends.
      if (!Number.isFinite(alignWidth)) {
        return align === 'center' ? -inkWidth / 2 : -inkWidth;
      }
      const slack = alignWidth - inkWidth;
      return align === 'center' ? slack / 2 : slack;
    })();
    const lineX0 = alignShift;
    // One baseline for the whole line, sunk far enough below the line top to
    // clear whichever run reaches highest above it. A blank line falls back
    // to the newline that closed it. Computed from *unshifted* ascents:
    // letting `baselineShift` feed back would drag the rest of the line with it.
    let lineAscent = 0;
    for (const e of line.entries) lineAscent = Math.max(lineAscent, aboveBaseline(e));
    if (line.entries.length === 0 && line.blank) lineAscent = aboveBaseline(line.blank);
    const lineBaselineY = penY + lineAscent;

    const cells: LaidOutCell[] = new Array(line.entries.length);

    // Visual order for this line, as positions within `line.entries`. Without
    // an engine that is logical order.
    const flatOf = line.entries.map((e) => e.flat);
    const posOfFlat = new Map<number, number>();
    flatOf.forEach((f, pos) => posOfFlat.set(f, pos));
    let visual: number[] = line.entries.map((_, k) => k);
    let levelOf: (pos: number) => number = () => 0;
    if (paragraphs !== null && line.entries.length > 0) {
      const from = flatOf[0];
      const to = flatOf[flatOf.length - 1] + 1;
      const r = paragraphs.reorder(from, to);
      const seen = new Set<number>();
      const ordered: number[] = [];
      for (const f of r.order) {
        const pos = posOfFlat.get(f);
        if (pos !== undefined && !seen.has(pos)) { ordered.push(pos); seen.add(pos); }
      }
      levelOf = (pos) => {
        const l = r.levels[flatOf[pos] - from];
        return typeof l === 'number' && l >= 0 ? l : 0;
      };
      // A position the engine dropped still holds a cell here.
      visual = restoreRemoved(ordered, line.entries.length, (pos) => levelOf(pos) % 2 === 1);
    }

    // L4 — a bracket in a right-to-left run paints as its mirror. Done here
    // rather than during analysis because the same code point mirrors in one
    // run and not in another, and the level is only known now.
    if (bidi) {
      for (let pos = 0; pos < line.entries.length; pos++) {
        if (levelOf(pos) % 2 === 0) continue;
        const e = line.entries[pos];
        const m = bidi.mirror(e.cp);
        if (m === null || m === e.cp) continue;
        // The outline tier reads `cp` directly; the atlas tier needs the other
        // glyph looked up. A face without it keeps the unmirrored one.
        if (e.font !== null) {
          const hit = resolveGlyph(e.run, e.font, e.resolved, m, false);
          if (!hit) continue;
          // The mirror may come from another tier, and then it samples that
          // tier's atlas. The advance stays the one the wrap measured.
          if (hit.font !== e.font) {
            e.font = hit.font;
            e.metrics = atlasMetrics(hit.font);
            e.resolved = hit.resolved;
          }
          e.glyph = hit.glyph;
        }
        e.cp = m;
      }
    }

    // L1 gives a line's trailing spaces the paragraph's level, so in a
    // right-to-left paragraph they reorder to the left and hang off that side.
    const hangsLeft = hung > 0 && levelOf(line.entries.length - 1) % 2 === 1;
    const lineLeft = hangsLeft ? lineX0 - hung : lineX0;
    let penX = lineLeft;
    let prevPos = -1;
    for (const pos of visual) {
      const e = line.entries[pos];
      // Kerning is a gap between two *adjacent* characters, and the wrap
      // measured it logically. Reordering can put a different pair side by
      // side: take the gap that belongs to whichever of the two is logically
      // second, and none at all across a direction boundary, where the pair
      // never touched in the source.
      penX += prevPos < 0 ? 0
        : pos === prevPos + 1 ? e.kerningBefore
        : prevPos === pos + 1 ? line.entries[prevPos].kerningBefore
        : 0;
      prevPos = pos;
      // One step per character: the glyph's advance plus its run's tracking,
      // plus a justified gap's share of the slack. Every branch below moves
      // the pen by exactly this, so glyph positions stay in step with the line
      // width accumulated above.
      const step = e.advance + e.tracking + (gaps.has(pos) ? gapExtra : 0);
      const cell: LaidOutCell = {
        srcIndex: e.srcIndex, srcEnd: e.srcEnd, cp: e.cp, x: penX,
        advance: step, level: levelOf(pos),
        drawsInk: e.drawsInk,
        clusterEnd: closesCluster[e.flat],
      };
      cells[pos] = cell;
      const scale = e.fontSize / e.metrics.size;
      // Positive raises, and y grows down, so the shift subtracts. `?? 0`
      // because the authored run type makes the field optional: absent it,
      // every vertical coordinate goes NaN and the glyphs draw as zero-area quads.
      const baselineY = lineBaselineY - (e.run.baselineShift ?? 0);

      // Extend or (re)open the decoration span *before* the no-ink bail-out
      // below, so a decorated span's spaces stay under the rule. `step`
      // includes this glyph's trailing tracking, so the rule covers it.
      // An unfilled run's rules are dropped with its glyphs: a rule is a solid
      // rect with only a fill to paint it.
      const decoFill = e.run.fill;
      if (decoFill !== null && (e.run.underline || e.run.strikethrough || e.run.overline)) {
        const face = runFaces.get(e.run);
        if (
          span !== null
          && span.underline === e.run.underline
          && span.strikethrough === e.run.strikethrough
          && span.overline === e.run.overline
          && span.fontSize === e.run.fontSize
          && span.face === face
          && span.baselineY === baselineY
          && sameFill(span.fill.paint ?? null, decoFill.paint ?? null)
        ) {
          // Absorbs the kerning gap we just stepped over, so a run join
          // between two identically-decorated runs shows no seam.
          span.x1 = penX + step;
        } else {
          flushSpan();
          span = {
            underline: e.run.underline,
            strikethrough: e.run.strikethrough,
            overline: e.run.overline,
            fill: decoFill,
            // The run's size, not the glyph's: a small-caps word is one rule.
            fontSize: e.run.fontSize,
            face,
            baselineY,
            x0: penX,
            x1: penX + step,
          };
        }
      } else {
        flushSpan();
      }

      // Outline tier, decided per glyph at its run's size. Checked before the
      // no-ink bail-out below, not after: a dynamic-tier glyph still waiting
      // for its bake has `page < 0` and no atlas rect, but its outline is
      // available right now.
      const outlineD = outlineFor(e);
      // An unfilled run paints through its stroke, and only tessellated
      // geometry can carry one — an atlas quad would paint the fill that was
      // refused, so it is not emitted at all.
      if (e.run.fill === null
          && !(outlineD !== null && strokePaints(e.run.stroke))) {
        penX += step;
        continue;
      }
      if (outlineD !== null) {
        const group = getOrCreateGroup(ctx, e.run, e.resolved, 0, 'outline');
        group.glyphs.push({
          d: outlineD,
          key: `${e.resolved.resolved.family}|${e.resolved.resolved.weight}|${e.resolved.resolved.style}|${e.cp}`,
          x: penX,
          baselineY,
          // Em space is unit-scale, so world units per em is just the size.
          scale: e.fontSize,
        });
        penX += step;
        continue;
      }

      // Nothing to paint — a zero-advance glyph (e.g. a combining mark), a
      // zero-area one (a space in either source), or a dynamic glyph not baked
      // yet (page < 0). Advance the pen anyway so the line doesn't reflow when
      // a bake lands, and so a space's tracking still separates its neighbors.
      if (e.font === null || e.glyph === null
          || e.advance === 0 || e.glyph.width === 0 || e.glyph.page < 0) {
        penX += step;
        continue;
      }
      const group = getOrCreateGroup(ctx, e.run, e.resolved, e.glyph.page);
      const atlasW = e.font.common.scaleW;
      const atlasH = e.font.common.scaleH;
      const qx0 = penX + e.glyph.xoffset * scale;
      // `yoffset` is measured from the line top in the atlas's own frame, so
      // subtracting that frame's baseline (`metrics.base`) hangs the glyph off
      // the line's shared baseline.
      const qy0 = baselineY + (e.glyph.yoffset - e.metrics.base) * scale;
      const qx1 = qx0 + e.glyph.width * scale;
      const qy1 = qy0 + e.glyph.height * scale;
      const u0 = e.glyph.x / atlasW;
      const v0 = e.glyph.y / atlasH;
      const u1 = (e.glyph.x + e.glyph.width) / atlasW;
      const v1 = (e.glyph.y + e.glyph.height) / atlasH;
      group.quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1, baselineY });
      penX += step;
    }
    // A rule never crosses a line break: close the span at end of line.
    flushSpan();
    // Closing stop: the line's right edge, at the offset just past its last
    // character. A blank line has no cell to close, so its only stop is the
    // newline that made it.
    const lastCell = line.entries[line.entries.length - 1];
    const srcEnd = lastCell ? lastCell.srcEnd : (line.blank?.srcIndex ?? 0);
    lineBoxes.push({
      x0: lineLeft,
      y0: penY,
      x1: lineLeft + line.width + spread,
      y1: penY + line.height,
      baselineY: lineBaselineY,
      cells,
      srcEnd,
    });
    maxLineWidth = Math.max(maxLineWidth, inkWidth + spread);
    penY += line.height;
  }

  // `bounds` measures line boxes only — a decoration rule, and a run shifted
  // off the baseline, can both fall outside it. Neither is reachable at the
  // 1.2 default with the bundled atlases and the `script` presets.
  return {
    groups: [...ctx.groups.values()],
    decorations,
    lines: lineBoxes,
    bounds: { width: maxLineWidth, height: penY },
  };
}
