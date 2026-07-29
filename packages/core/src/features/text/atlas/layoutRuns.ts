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
 */

import type { FillStyle } from 'core/paint-types';
import { resolveFontVariant, type ResolveResult, type BmFontChar, type BmFont } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';

export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
  /** Y coordinate of the line's baseline (penY at quad emission). Used by the
   *  synthetic-italic vertex skew so above-baseline vertices lean right. */
  baselineY: number;
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
   *  baked MSDF atlas or the runtime canvas-SDF dynamic atlas. */
  source: 'atlas' | 'canvas';
  /** Dynamic-atlas page index for 'canvas' groups; 0 for atlas groups. */
  page: number;
  fill: FillStyle;
  quads: LaidOutQuad[];
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

export interface LaidOutRuns {
  groups: LaidOutGroup[];
  /** Underline / strikethrough rules, in line order; underline before
   *  strikethrough within a span. Empty when nothing is decorated. */
  decorations: LaidOutDecoration[];
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
 */
const UNDERLINE_OFFSET = 0.10;
const STRIKETHROUGH_OFFSET = -0.30;
const DECORATION_THICKNESS = 0.05;

export interface LayoutRunsOpts {
  maxWidth: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
}

export interface LayoutRunsOrigin {
  x: number;
  y: number;
}

const FALLBACK_CODEPOINT = 63;

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

function groupKey(
  family: string,
  weight: number,
  style: 'normal' | 'italic',
  synthetic: { bold: boolean; italic: boolean },
  fill: FillStyle,
  source: 'atlas' | 'canvas',
  page: number,
): string {
  return `${family}|${weight}|${style}|${synthetic.bold ? 1 : 0}${synthetic.italic ? 1 : 0}|${fillKey(fill)}|${source}|${page}`;
}

function getOrCreateGroup(
  ctx: LayoutContext,
  run: ResolvedRun,
  resolved: ResolveResult,
  page: number,
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
  const source = resolved.source;
  const key = groupKey(
    atlasFamily,
    resolvedWeight,
    resolvedStyle,
    resolved.synthetic,
    run.fill,
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
      quads: [],
    };
    ctx.groups.set(key, g);
  }
  return g;
}

function resolveGlyph(font: BmFont, cp: number): BmFontChar | null {
  const direct = font.charMap.get(cp);
  if (direct) return direct;
  const fb = font.charMap.get(FALLBACK_CODEPOINT);
  if (fb) return fb;
  console.warn(`weasel layoutRuns: no glyph for codepoint ${cp} and no fallback '?'; skipping.`);
  return null;
}

export function layoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
  origin: LayoutRunsOrigin,
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

      const glyph = resolved.dynamicFace ? resolved.dynamicFace.requestGlyph(cp) : resolveGlyph(font, cp);
      if (!glyph) {
        prevCp = cp; prevFont = font; prevFontSize = run.fontSize;
        continue;
      }

      let kerningBefore = 0;
      if (prevCp !== undefined && prevFont !== undefined && prevFontSize !== undefined) {
        const kAtlas = prevFont.kerningMap.get(prevCp)?.get(cp) ?? 0;
        kerningBefore = kAtlas * (prevFontSize / prevFont.info.size);
      }

      entries.push({
        run, font, glyph, cp,
        advance: glyph.xadvance * scale,
        tracking,
        kerningBefore,
        isSpace, isNewline: false,
        resolved, fontSize: run.fontSize,
      });

      prevCp = cp; prevFont = font; prevFontSize = run.fontSize;
    }
  }

  // 2. Walk entries, accumulating lines bounded by maxWidth when finite.
  //    A "word" is a maximal run of non-space, non-newline entries; after
  //    each word, decide whether it fits on the current line.
  interface Line {
    entries: Entry[];
    width: number;
    height: number;
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
    if (e.isNewline) { commitLine(); i++; continue; }
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

  let penY = origin.y;
  let maxLineWidth = 0;
  const finiteWidth = Number.isFinite(opts.maxWidth) ? opts.maxWidth : 0;
  for (const line of lines) {
    const alignShift = (() => {
      if (opts.align === 'left') return 0;
      // With a finite box, distribute the slack within `maxWidth` (origin.x is
      // the box's left edge). With no box (infinite maxWidth), anchor on the
      // line's own width instead — origin.x is the text's midpoint ('center')
      // or right edge ('right'). This matches the canvas-2D `renderLabel`
      // anchor model so point-anchored labels center on x in both backends.
      if (!Number.isFinite(opts.maxWidth)) {
        return opts.align === 'center' ? -line.width / 2 : -line.width;
      }
      const slack = finiteWidth - line.width;
      return opts.align === 'center' ? slack / 2 : slack;
    })();
    let penX = origin.x + alignShift;
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
    bounds: { width: maxLineWidth, height: penY - origin.y },
  };
}
