/**
 * Runs-aware MSDF layout. Walks `ResolvedRun[]` codepoint-by-codepoint,
 * switching atlas per run via `resolveFontVariant`, applying kerning
 * (using the left glyph's atlas table and size scaling, including across
 * run boundaries), and bucketing emitted quads by
 * `(family, resolvedWeight, resolvedStyle, syntheticBold, syntheticItalic, fillKey)`
 * so the renderer issues one draw call per atlas+color group.
 *
 * A run's `letterSpacing` (world units, so it does not scale with `fontSize`)
 * is added to the advance *after* every character of that run, including the
 * last one on a line — the CSS `letter-spacing` rule, chosen so a DOM overlay
 * rendering the same text can be made to agree. Trailing tracking therefore
 * widens the measured line width and counts toward wrapping. Spaces are
 * tracked like any other character; a newline is not (it consumes no advance).
 * One caveat against CSS: tracking is applied per *code point*, not per
 * grapheme cluster, so `e` + U+0301 takes tracking twice where CSS would
 * space the cluster once.
 *
 * Word wrap is applied when `maxWidth` is finite: words are committed to
 * a new line when they would exceed the current line width. Forced line
 * breaks are emitted for `\n` codepoints. Mixed-size runs share a
 * baseline; line height is `max(fontSize * lineHeight)` across the line.
 *
 * Underline and strikethrough come out on a second channel, `decorations` —
 * solid rectangles, not textured glyphs, so they cannot ride in a group's
 * `quads` (which upload UVs into an MSDF program). They are accumulated
 * during the same per-line pen walk that emits quads, *not* reconstructed
 * from quad extents afterwards: quads exist only for glyphs with ink, so a
 * decorated span's spaces would punch holes in a rule derived from them.
 *
 * ### Coordinates are origin-relative
 *
 * Every coordinate out of here is measured from the text's own top-left, not
 * from anywhere on the page: the caller translates. That is what lets a text
 * node be dragged without re-laying out — `layoutCache` would otherwise need
 * the position in its key and miss on every frame of the drag — and it costs
 * the caller one addition per vertex, inside loops already walking every one.
 * Alignment, wrapping, tracking and decoration placement all read widths and
 * pen deltas, never an absolute coordinate, so the translation is exact.
 */

import type { FillStyle, Stroke } from '@weasel-js/paint';
import {
  resolveFontVariant, resolveGlyphFallback, glyphOutline,
  type ResolveResult, type BmFontChar, type BmFont,
} from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';

/** One textured glyph quad, origin-relative — see the header. */
export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
  /** Y coordinate of the line's baseline (penY at quad emission). Used by the
   *  synthetic-italic vertex skew so above-baseline vertices lean right. */
  baselineY: number;
}

/**
 * One glyph the renderer should tessellate rather than sample: real font
 * outline geometry, for text large enough that a distance field shows the
 * raster it was reconstructed from.
 *
 * `d` is em-space SVG path data straight from `@weasel-js/font`'s outline
 * registry — 1 unit is 1 em, y grows down, origin on the baseline at the pen.
 * Placing it is therefore a uniform scale by `scale` (world units per em)
 * followed by a translate to `(x, baselineY)`, and nothing here depends on
 * zoom: the same glyph at the same size in two places is the same geometry
 * twice, which is what lets the renderer tessellate it once and cache it.
 *
 * `key` identifies that cached tessellation — face identity plus codepoint,
 * assembled here because layout is where both are in hand.
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

export interface LaidOutGroup {
  /** Resolved atlas family — may differ from the requested family when the
   *  cross-family fallback policy substituted a default. This is what the
   *  renderer looks the atlas up by, so it must be the one that resolves. */
  family: string;
  /** Resolved variant — matches the registered atlas and the texture-cache key. */
  weight: number;
  style: 'normal' | 'italic';
  /** Gap between the request and the resolved match. Drives shader uniforms. */
  synthetic: { bold: boolean; italic: boolean };
  /** Which glyph source (and therefore shader/texture) this group binds:
   *  baked MSDF atlas, the runtime canvas-SDF dynamic atlas, or tessellated
   *  font outlines. */
  source: 'atlas' | 'canvas' | 'outline';
  /** Dynamic-atlas page index for 'canvas' groups; 0 for the others. */
  page: number;
  fill: FillStyle;
  /** Outline painted over the glyphs, or absent for none. Only ever set on
   *  an `'outline'` group — the SDF tiers have no geometry to stroke, which
   *  is why a stroke pulls its run onto the outline tier at any size. A run
   *  the tier cannot serve at all (no registered outlines, synthetic bold)
   *  stays on the atlas and carries the request no further. */
  stroke?: Stroke;
  /** Textured glyph quads. Always empty for an `'outline'` group. */
  quads: LaidOutQuad[];
  /** Outline geometry. Always empty for an `'atlas'` / `'canvas'` group —
   *  the two channels are exclusive, since the group is also the draw call
   *  and one draw call binds one program. */
  glyphs: LaidOutOutlineGlyph[];
}

/**
 * One decoration rule: an axis-aligned solid rectangle in the same world
 * space as `LaidOutQuad`. Never spans a line break, and carries the fill of
 * the run(s) it decorates so the rule follows the text colour.
 */
export interface LaidOutDecoration {
  kind: 'underline' | 'strikethrough';
  x0: number; y0: number; x1: number; y1: number;
  fill: FillStyle;
}

/**
 * One laid-out line's box, in the same world space as `LaidOutQuad`.
 *
 * `[x0, x1]` is the line's own advance width *after* alignment — not the
 * wrap box — so a short centered line reports the span it actually occupies.
 * `[y0, y1]` is the full line box: `y0` is the pen's line top, `y1` is
 * `y0 + max(fontSize * lineHeight)` over the line's runs. Ink can escape it
 * vertically (a tall accent, a deep descender at a lineHeight below ~1.06 —
 * see the `bounds` note at the end of `layoutRuns`); this is the typographic
 * box, not an ink bounding box.
 *
 * Emitted for every line including empty ones, so indices line up with the
 * wrap. An empty line has `x0 === x1`.
 */
export interface LaidOutLineBox {
  x0: number; y0: number; x1: number; y1: number;
  /** The line's baseline, for callers placing carets or rules against it. */
  baselineY: number;
}

export interface LaidOutRuns {
  groups: LaidOutGroup[];
  /** Underline / strikethrough rules, in line order; underline before
   *  strikethrough within a span. Empty when nothing is decorated. */
  decorations: LaidOutDecoration[];
  /** Per-line boxes in layout order. Lets a caller reason about where the
   *  text actually sits inside its wrap box without re-running the wrap —
   *  `textLineBoxes` builds the text silhouette from these, so picking and
   *  painting cannot drift apart. */
  lines: LaidOutLineBox[];
  bounds: { width: number; height: number };
}

/**
 * Decoration placement and weight, as fractions of the run's `fontSize`.
 * Offsets are the *top* edge of the rule, measured down from the baseline.
 *
 * DERIVED, NOT MEASURED. `BmFont` exposes only `info.size`, `common.base`
 * and `common.lineHeight` — a BMFont JSON carries no decoration metrics at
 * all. A future HarfBuzz / OpenType path would read the real
 * `underlinePosition` and `underlineThickness` off the `post` table and
 * retire these three numbers.
 *
 * Pinned by `tests/visual/text-decoration.spec.ts`, which measures the gap
 * between the two rules rather than a golden image — `text.spec.ts`'s 5%
 * tolerance cannot see one of these move.
 */
const UNDERLINE_OFFSET = 0.10;
const STRIKETHROUGH_OFFSET = -0.30;
const DECORATION_THICKNESS = 0.05;

export interface LayoutRunsOpts {
  maxWidth: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  /**
   * World-space `fontSize` at or above which glyphs are emitted as outline
   * geometry, when the resolved face has outlines registered. Omit (the
   * default) to keep every glyph on its SDF tier.
   *
   * A *world* size rather than a screen size because layout knows nothing
   * about the view; `drawText` divides its screen-pixel threshold by the view
   * scale before calling, so zooming in lowers the world size that qualifies.
   *
   * This is a rendering switch only. Advances, kerning, wrapping and
   * baselines are identical either way — the outline tier changes what a
   * glyph looks like, never where it sits — so measurement callers
   * (`measureTextBounds`, `textLineBoxes`) leave it unset and still agree
   * with the paint, and crossing the threshold cannot reflow text.
   */
  outlineMinSize?: number;
}

interface LayoutContext {
  groups: Map<string, LaidOutGroup>;
}

function fillKey(p: FillStyle): string {
  if ('color' in p) return `s:${p.color}:${p.opacity ?? 1}`;
  // Non-solid paints (gradients/patterns) defeat grouping in this slice —
  // every occurrence gets its own group. Acceptable in v1 since per-run
  // non-solid fills are rare; revisit if it bites perf.
  return `nx:${Math.random()}`;
}

/**
 * Whether two runs' fills paint the same, for the purpose of merging their
 * decoration rules. Solid paints compare by value so two separate runs set
 * to the same colour merge; anything else compares by reference, because a
 * gradient/pattern has no cheap structural equality and a false positive
 * would paint one run's rule with another's paint.
 */
function sameFill(a: FillStyle, b: FillStyle): boolean {
  if (a === b) return true;
  if ('color' in a && 'color' in b) {
    return a.color === b.color && (a.opacity ?? 1) === (b.opacity ?? 1);
  }
  return false;
}

/** Whether a stroke puts ink down — an omitted or zero-width one does not,
 *  and must not pull a run onto the outline tier for nothing. A screen-pixel
 *  width is positive on the same terms; what it resolves to in world units
 *  depends on a scale this layer does not have and does not need. */
function strokePaints(s: Stroke | undefined): boolean {
  if (s === undefined) return false;
  const w = s.width ?? 1;
  return (typeof w === 'number' ? w : w.px) > 0;
}

/**
 * Draw state for a stroke, for grouping. Two runs stroked the same way share
 * a draw call; anything else has to split, since the group *is* the draw call
 * and one call paints one ribbon. Paint identity reuses `fillKey`, so a
 * gradient-stroked run gets its own group the same way a gradient-filled one
 * does.
 */
function strokeKey(s: Stroke | undefined): string {
  if (!s) return '-';
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
  style: 'normal' | 'italic',
  synthetic: { bold: boolean; italic: boolean },
  fill: FillStyle,
  stroke: Stroke | undefined,
  source: 'atlas' | 'canvas' | 'outline',
  page: number,
): string {
  return `${family}|${weight}|${style}|${synthetic.bold ? 1 : 0}${synthetic.italic ? 1 : 0}|${fillKey(fill)}|${strokeKey(stroke)}|${source}|${page}`;
}

/**
 * `source` overrides the tier the resolver picked. Passed for outline glyphs,
 * which are served by a face the *resolver* still reports as atlas or canvas
 * — the tier decision for a glyph is made per glyph, at its size, not per run
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
  // uploads no texture and draws no quads — the run would occupy layout space
  // and paint nothing. It also has to be in the key: two requested families
  // substituting to different atlases must not collide, and two substituting to
  // the same atlas should merge into one draw call.
  const atlasFamily = resolved.resolved.family;
  const resolvedWeight = resolved.resolved.weight;
  const resolvedStyle = resolved.resolved.style;
  const source = sourceOverride ?? resolved.source;
  const key = groupKey(
    atlasFamily,
    resolvedWeight,
    resolvedStyle,
    resolved.synthetic,
    run.fill,
    source === 'outline' ? run.stroke : undefined,
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
      ...(source === 'outline' && run.stroke !== undefined ? { stroke: run.stroke } : {}),
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
 * Find a glyph for `cp`, escalating past the run's atlas when it has none.
 *
 * Until 2026-07-29 a miss drew codepoint 63 — a literal `?`. That fabricates
 * a character the author never wrote and is indistinguishable from one they
 * did, which is how the committed text baseline came to read "Themed editing
 * ? magenta caret" for a whole commit without anyone noticing. Every real
 * text stack draws `.notdef` (tofu) precisely because it can't be mistaken
 * for content; the BmFont atlas format has no such glyph to draw, so the
 * order here is: the atlas, then the dynamic tier (which rasterizes from
 * installed fonts and can usually serve the character for real), then
 * nothing — with a warning naming the codepoint.
 */
function resolveGlyph(
  run: ResolvedRun,
  font: BmFont,
  resolved: ResolveResult,
  cp: number,
): GlyphHit | null {
  const direct = font.charMap.get(cp);
  if (direct) return { glyph: direct, font, resolved };

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

  warnMissingGlyphOnce(resolved.resolved.family, cp);
  return null;
}

// Layout runs per frame, so an unguarded warn would flood the console. Keyed
// per (family, codepoint): one message per character the app actually can't
// draw, however many times it appears.
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

export function layoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
): LaidOutRuns {
  const ctx: LayoutContext = { groups: new Map() };

  // Per-glyph entry produced by walking runs codepoint-by-codepoint.
  // Position (x) is filled in during the line-fitting pass.
  interface Entry {
    run: ResolvedRun;
    font: BmFont;
    glyph: BmFontChar;
    cp: number;
    advance: number;         // xadvance in world units (already scaled)
    tracking: number;        // run letterSpacing, added after this glyph (world units)
    kerningBefore: number;   // kerning gap consumed before this glyph
    isSpace: boolean;
    isNewline: boolean;
    resolved: ResolveResult;
    fontSize: number;
  }

  // 1. Flatten all runs into entries with per-glyph data, computing
  //    kerning using the left glyph's atlas+scale across run boundaries.
  const entries: Entry[] = [];
  let prevCp: number | undefined;
  let prevFont: BmFont | undefined;
  let prevFontSize: number | undefined;

  for (const run of runs) {
    const resolved = resolveFontVariant(run.fontFamily, run.fontWeight, run.fontStyle);
    const font = resolved.entry?.font ?? resolved.dynamicFace?.font;
    if (!font) {
      prevCp = undefined; prevFont = undefined; prevFontSize = undefined;
      continue;
    }
    const scale = run.fontSize / font.info.size;
    // World units — deliberately not scaled by fontSize, so the same tracking
    // opens the same visual gap whatever size the run is set at.
    const tracking = run.letterSpacing;

    for (const ch of [...run.text]) {
      const cp = ch.codePointAt(0)!;
      const isNewline = cp === 10;
      const isSpace = cp === 32;

      if (isNewline) {
        entries.push({
          run, font,
          glyph: { id: cp, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
          // A newline consumes no advance, so it takes no tracking either.
          cp, advance: 0, tracking: 0, kerningBefore: 0, isSpace: false, isNewline: true,
          resolved, fontSize: run.fontSize,
        });
        prevCp = undefined; prevFont = undefined; prevFontSize = undefined;
        continue;
      }

      if (isSpace) {
        // Use atlas glyph if present; otherwise synthesize a zero-size entry
        // with a reasonable advance so spaces still participate in line-fitting.
        const spaceGlyph = resolved.dynamicFace ? resolved.dynamicFace.requestGlyph(32) : font.charMap.get(32);
        const advance = spaceGlyph
          ? spaceGlyph.xadvance * scale
          : run.fontSize * 0.25;
        let kerningBefore = 0;
        if (prevCp !== undefined && prevFont !== undefined && prevFontSize !== undefined) {
          const kAtlas = prevFont.kerningMap.get(prevCp)?.get(cp) ?? 0;
          kerningBefore = kAtlas * (prevFontSize / prevFont.info.size);
        }
        entries.push({
          run, font,
          glyph: spaceGlyph ?? { id: 32, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
          cp, advance, tracking, kerningBefore, isSpace: true, isNewline: false,
          resolved, fontSize: run.fontSize,
        });
        prevCp = cp; prevFont = font; prevFontSize = run.fontSize;
        continue;
      }

      const hit = resolved.dynamicFace
        ? { glyph: resolved.dynamicFace.requestGlyph(cp), font, resolved }
        : resolveGlyph(run, font, resolved, cp);
      if (!hit) {
        prevCp = cp; prevFont = font; prevFontSize = run.fontSize;
        continue;
      }
      // An escalated codepoint is served by a different atlas with its own
      // bake size, so its scale — and the group it lands in — are its own.
      const glyphFont = hit.font;
      const glyphScale = run.fontSize / glyphFont.info.size;

      let kerningBefore = 0;
      if (prevCp !== undefined && prevFont !== undefined && prevFontSize !== undefined) {
        const kAtlas = prevFont.kerningMap.get(prevCp)?.get(cp) ?? 0;
        kerningBefore = kAtlas * (prevFontSize / prevFont.info.size);
      }

      entries.push({
        run, font: glyphFont, glyph: hit.glyph, cp,
        advance: hit.glyph.xadvance * glyphScale,
        tracking,
        kerningBefore,
        isSpace, isNewline: false,
        resolved: hit.resolved, fontSize: run.fontSize,
      });

      prevCp = cp; prevFont = glyphFont; prevFontSize = run.fontSize;
    }
  }

  // 2. Walk entries, accumulating lines bounded by maxWidth when finite.
  //    A "word" is a maximal run of non-space, non-newline entries; after
  //    each word, decide whether it fits on the current line.
  interface Line {
    entries: Entry[];
    width: number;
    height: number;
    /** Set only for a line with no entries at all — the newline that closed
     *  it, which is the only carrier of the style a blank line should take
     *  its height and baseline from. */
    blank?: Entry;
  }
  const lines: Line[] = [];
  let cur: Line = { entries: [], width: 0, height: 0 };

  function commitLine(): void {
    lines.push(cur);
    cur = { entries: [], width: 0, height: 0 };
  }

  let i = 0;
  while (i < entries.length) {
    const e = entries[i];
    if (e.isNewline) {
      // A blank line still advances the pen. `cur.height` is only raised when
      // an entry is pushed, so without this a line holding nothing but the
      // newline itself measured zero and `"a\n\nb"` painted `b` directly
      // under `a` — the blank line vanished instead of opening a gap. The
      // newline's own run supplies the style, since no other entry can.
      if (cur.entries.length === 0) {
        cur.height = Math.max(cur.height, e.fontSize * opts.lineHeight);
        cur.blank = e;
      }
      commitLine(); i++; continue;
    }
    if (e.isSpace) {
      if (cur.entries.length > 0) {
        cur.entries.push(e);
        cur.width += e.kerningBefore + e.advance + e.tracking;
        cur.height = Math.max(cur.height, e.fontSize * opts.lineHeight);
      }
      i++;
      continue;
    }
    // Accumulate the upcoming word: entries up to next space/newline/EOR.
    let j = i;
    let wordWidth = 0;
    while (j < entries.length && !entries[j].isSpace && !entries[j].isNewline) {
      const w = entries[j];
      wordWidth += w.kerningBefore + w.advance + w.tracking;
      j++;
    }
    if (Number.isFinite(opts.maxWidth) && cur.width + wordWidth > opts.maxWidth && cur.entries.length > 0) {
      commitLine();
    }
    for (let k = i; k < j; k++) {
      const w = entries[k];
      const kerningBefore = cur.entries.length === 0 ? 0 : w.kerningBefore;
      cur.entries.push({ ...w, kerningBefore });
      cur.width += kerningBefore + w.advance + w.tracking;
      cur.height = Math.max(cur.height, w.fontSize * opts.lineHeight);
    }
    i = j;
  }
  if (cur.entries.length > 0) commitLine();

  /**
   * Em-space outline for `e`, or `null` to leave it on its SDF tier.
   *
   * Every `null` here is a rung of the fallback ladder, and they are all
   * ordinary: the caller never opted in, the glyph is too small to be worth
   * it, the face has no outlines registered, its bytes are still loading or
   * failed to load, or the font simply has no such glyph. The tier is an
   * upgrade applied where it is available, never a requirement.
   */
  function outlineFor(e: Entry): string | null {
    const min = opts.outlineMinSize;
    if (min === undefined) return null;
    // A stroked run ignores the size gate. The gate is there because the SDF
    // tiers reconstruct small text better than tessellated geometry does —
    // but they have no geometry to stroke, so leaving a stroked run below the
    // threshold drops the outline the consumer asked for rather than trading
    // one correct rendering for another.
    if (e.fontSize < min && !strokePaints(e.run.stroke)) return null;
    // Synthetic bold is an SDF threshold shift, and a path has no threshold.
    // Emboldening geometry properly means offsetting the outline — the same
    // problem as stroke-to-fill, which the kit does not solve yet — and
    // painting the regular weight instead would make text get *lighter* as
    // you zoom past the threshold. Leave it with the tier that can fake it.
    // Synthetic italic is not in the same position: a shear is exact on
    // geometry, and the renderer applies it.
    if (e.resolved.synthetic.bold) return null;
    const r = e.resolved.resolved;
    return glyphOutline(r.family, r.weight, r.style, e.cp);
  }

  // 3. Lay out each line: apply alignment, then emit quads (and the
  //    decoration rules that span them).
  const decorations: LaidOutDecoration[] = [];

  /** An open decoration span: contiguous entries on one line that agree on
   *  which rules to draw, what colour to draw them, and the metrics that set
   *  their placement. `x1` grows as the pen walks. */
  interface DecoSpan {
    underline: boolean;
    strikethrough: boolean;
    fill: FillStyle;
    fontSize: number;
    baselineY: number;
    x0: number;
    x1: number;
  }
  let span: DecoSpan | null = null;

  function flushSpan(): void {
    const s = span;
    span = null;
    if (!s || s.x1 <= s.x0) return;
    const thickness = s.fontSize * DECORATION_THICKNESS;
    if (s.underline) {
      const y0 = s.baselineY + s.fontSize * UNDERLINE_OFFSET;
      decorations.push({ kind: 'underline', x0: s.x0, y0, x1: s.x1, y1: y0 + thickness, fill: s.fill });
    }
    if (s.strikethrough) {
      const y0 = s.baselineY + s.fontSize * STRIKETHROUGH_OFFSET;
      decorations.push({ kind: 'strikethrough', x0: s.x0, y0, x1: s.x1, y1: y0 + thickness, fill: s.fill });
    }
  }

  const lineBoxes: LaidOutLineBox[] = [];
  let penY = 0;
  let maxLineWidth = 0;
  const finiteWidth = Number.isFinite(opts.maxWidth) ? opts.maxWidth : 0;
  for (const line of lines) {
    const alignShift = (() => {
      if (opts.align === 'left') return 0;
      // With a finite box, distribute the slack within `maxWidth` (x = 0 is
      // the box's left edge). With no box (infinite maxWidth), anchor on the
      // line's own width instead — x = 0 is the text's midpoint ('center')
      // or right edge ('right'). This matches the canvas-2D `renderLabel`
      // anchor model so point-anchored labels center on x in both backends.
      if (!Number.isFinite(opts.maxWidth)) {
        return opts.align === 'center' ? -line.width / 2 : -line.width;
      }
      const slack = finiteWidth - line.width;
      return opts.align === 'center' ? slack / 2 : slack;
    })();
    const lineX0 = alignShift;
    // The line's baseline, recorded for the box below. Every entry on a line
    // shares `penY`, but not necessarily `font`/`fontSize` — a mixed-size line
    // has one baseline per run under this model, and the first entry's is the
    // one the box reports. A blank line has no entry at all, so it falls back
    // to the newline that closed it.
    const baselineSource = line.entries[0] ?? line.blank;
    const lineBaselineY = baselineSource
      ? penY + baselineSource.font.common.base
        * (baselineSource.fontSize / baselineSource.font.info.size)
      : penY;

    let penX = lineX0;
    for (const e of line.entries) {
      penX += e.kerningBefore;
      // One step per character: the glyph's advance plus its run's tracking.
      // Every branch below moves the pen by exactly this, so glyph positions
      // stay in step with the line width accumulated above.
      const step = e.advance + e.tracking;
      const scale = e.fontSize / e.font.info.size;
      const baselineY = penY + e.font.common.base * scale;

      // Extend or (re)open the decoration span *before* the no-ink bail-out
      // below, so a decorated span's spaces stay under the rule. `step`
      // includes this glyph's trailing tracking, so the rule covers it — the
      // CSS rule, and the same span the line width already accounts for.
      if (e.run.underline || e.run.strikethrough) {
        if (
          span !== null
          && span.underline === e.run.underline
          && span.strikethrough === e.run.strikethrough
          && span.fontSize === e.fontSize
          && span.baselineY === baselineY
          && sameFill(span.fill, e.run.fill)
        ) {
          // Absorbs the kerning gap we just stepped over, so a run join
          // between two identically-decorated runs shows no seam.
          span.x1 = penX + step;
        } else {
          flushSpan();
          span = {
            underline: e.run.underline,
            strikethrough: e.run.strikethrough,
            fill: e.run.fill,
            fontSize: e.fontSize,
            baselineY,
            x0: penX,
            x1: penX + step,
          };
        }
      } else {
        flushSpan();
      }

      // Outline tier, decided per glyph at its own size. Checked before the
      // no-ink bail-out below, not after: a dynamic-tier glyph still waiting
      // for its bake has `page < 0` and no atlas rect, but its outline is
      // available right now — there is no reason to draw nothing while the
      // exact geometry is in hand.
      const outlineD = outlineFor(e);
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
      if (e.advance === 0 || e.glyph.width === 0 || e.glyph.page < 0) {
        penX += step;
        continue;
      }
      const group = getOrCreateGroup(ctx, e.run, e.resolved, e.glyph.page);
      const atlasW = e.font.common.scaleW;
      const atlasH = e.font.common.scaleH;
      const qx0 = penX + e.glyph.xoffset * scale;
      const qy0 = penY + e.glyph.yoffset * scale;
      const qx1 = qx0 + e.glyph.width * scale;
      const qy1 = qy0 + e.glyph.height * scale;
      const u0 = e.glyph.x / atlasW;
      const v0 = e.glyph.y / atlasH;
      const u1 = (e.glyph.x + e.glyph.width) / atlasW;
      const v1 = (e.glyph.y + e.glyph.height) / atlasH;
      // `baselineY` (computed above) is the typographic baseline, not the top
      // of the line box — above-baseline vertices have y < baselineY so the
      // synthetic italic skew leans them right.
      group.quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1, baselineY });
      penX += step;
    }
    // A rule never crosses a line break: close the span at end of line.
    flushSpan();
    lineBoxes.push({
      x0: lineX0,
      y0: penY,
      x1: lineX0 + line.width,
      y1: penY + line.height,
      baselineY: lineBaselineY,
    });
    maxLineWidth = Math.max(maxLineWidth, line.width);
    penY += line.height;
  }

  // `bounds` measures line boxes only — a decoration rule can fall outside it.
  // An underline's bottom sits `base * scale + (UNDERLINE_OFFSET +
  // DECORATION_THICKNESS) * fontSize` below the line top, so it escapes the
  // last line once `lineHeight` drops below roughly `base / info.size + 0.15`
  // (≈1.06 for the bundled atlases). Not reachable at the 1.2 default, so
  // `measureTextBounds` and `verticalAlign: 'bottom'` are left as they are;
  // tightening the box would move every existing text bound.
  return {
    groups: [...ctx.groups.values()],
    decorations,
    lines: lineBoxes,
    bounds: { width: maxLineWidth, height: penY },
  };
}
