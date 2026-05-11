/**
 * Runs-aware MSDF layout. Walks `ResolvedRun[]` codepoint-by-codepoint,
 * switching atlas per run via `resolveFontVariant`, applying kerning
 * (using the left glyph's atlas table and size scaling, including across
 * run boundaries), and bucketing emitted quads by
 * `(family, resolvedWeight, resolvedStyle, syntheticBold, syntheticItalic, fillKey)`
 * so the renderer issues one draw call per atlas+color group.
 *
 * Word wrap is applied when `maxWidth` is finite: words are committed to
 * a new line when they would exceed the current line width. Forced line
 * breaks are emitted for `\n` codepoints. Mixed-size runs share a
 * baseline; line height is `max(fontSize * lineHeight)` across the line.
 */

import type { Paint } from 'core/paint-types';
import type { BmFontChar, BmFont } from './FontAtlas';
import type { ResolvedRun } from '../runs/resolveRuns';
import { resolveFontVariant, type ResolveResult } from './registerFont';

export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
  /** Y coordinate of the line's baseline (penY at quad emission). Used by the
   *  synthetic-italic vertex skew so above-baseline vertices lean right. */
  baselineY: number;
}

export interface LaidOutGroup {
  family: string;
  /** Resolved variant — matches the registered atlas and the texture-cache key. */
  weight: number;
  style: 'normal' | 'italic';
  /** Gap between the request and the resolved match. Drives shader uniforms. */
  synthetic: { bold: boolean; italic: boolean };
  fill: Paint;
  quads: LaidOutQuad[];
}

export interface LaidOutRuns {
  groups: LaidOutGroup[];
  bounds: { width: number; height: number };
}

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

function fillKey(p: Paint): string {
  if ('color' in p) return `s:${p.color}:${p.opacity ?? 1}`;
  // Non-solid paints (gradients/patterns) defeat grouping in this slice —
  // every occurrence gets its own group. Acceptable in v1 since per-run
  // non-solid fills are rare; revisit if it bites perf.
  return `nx:${Math.random()}`;
}

function groupKey(
  family: string,
  weight: number,
  style: 'normal' | 'italic',
  synthetic: { bold: boolean; italic: boolean },
  fill: Paint,
): string {
  return `${family}|${weight}|${style}|${synthetic.bold ? 1 : 0}${synthetic.italic ? 1 : 0}|${fillKey(fill)}`;
}

function getOrCreateGroup(
  ctx: LayoutContext,
  run: ResolvedRun,
  resolved: ResolveResult,
): LaidOutGroup {
  const resolvedWeight = resolved.resolved.weight;
  const resolvedStyle = resolved.resolved.style;
  const key = groupKey(
    run.fontFamily,
    resolvedWeight,
    resolvedStyle,
    resolved.synthetic,
    run.fill,
  );
  let g = ctx.groups.get(key);
  if (!g) {
    g = {
      family: run.fontFamily,
      weight: resolvedWeight,
      style: resolvedStyle,
      synthetic: { ...resolved.synthetic },
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
    kerningBefore: number;   // kerning gap consumed before this glyph
    isSpace: boolean;
    isNewline: boolean;
    group: LaidOutGroup;
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
    if (!resolved.entry) {
      prevCp = undefined; prevFont = undefined; prevFontSize = undefined;
      continue;
    }
    const font = resolved.entry.font;
    const scale = run.fontSize / font.info.size;
    const group = getOrCreateGroup(ctx, run, resolved);

    for (const ch of [...run.text]) {
      const cp = ch.codePointAt(0)!;
      const isNewline = cp === 10;
      const isSpace = cp === 32;

      if (isNewline) {
        entries.push({
          run, font,
          glyph: { id: cp, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
          cp, advance: 0, kerningBefore: 0, isSpace: false, isNewline: true,
          group, fontSize: run.fontSize,
        });
        prevCp = undefined; prevFont = undefined; prevFontSize = undefined;
        continue;
      }

      if (isSpace) {
        // Use atlas glyph if present; otherwise synthesize a zero-size entry
        // with a reasonable advance so spaces still participate in line-fitting.
        const spaceGlyph = font.charMap.get(32);
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
          cp, advance, kerningBefore, isSpace: true, isNewline: false,
          group, fontSize: run.fontSize,
        });
        prevCp = cp; prevFont = font; prevFontSize = run.fontSize;
        continue;
      }

      const glyph = resolveGlyph(font, cp);
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
        kerningBefore,
        isSpace, isNewline: false,
        group, fontSize: run.fontSize,
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
        cur.width += e.kerningBefore + e.advance;
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
      wordWidth += w.kerningBefore + w.advance;
      j++;
    }
    if (Number.isFinite(opts.maxWidth) && cur.width + wordWidth > opts.maxWidth && cur.entries.length > 0) {
      commitLine();
    }
    for (let k = i; k < j; k++) {
      const w = entries[k];
      const kerningBefore = cur.entries.length === 0 ? 0 : w.kerningBefore;
      cur.entries.push({ ...w, kerningBefore });
      cur.width += kerningBefore + w.advance;
      cur.height = Math.max(cur.height, w.fontSize * opts.lineHeight);
    }
    i = j;
  }
  if (cur.entries.length > 0) commitLine();

  // 3. Lay out each line: apply alignment, then emit quads.
  let penY = origin.y;
  let maxLineWidth = 0;
  const finiteWidth = Number.isFinite(opts.maxWidth) ? opts.maxWidth : 0;
  for (const line of lines) {
    const alignShift = (() => {
      if (opts.align === 'left' || !Number.isFinite(opts.maxWidth)) return 0;
      const slack = finiteWidth - line.width;
      return opts.align === 'center' ? slack / 2 : slack;
    })();
    let penX = origin.x + alignShift;
    for (const e of line.entries) {
      penX += e.kerningBefore;
      if (e.advance === 0) continue;
      const scale = e.fontSize / e.font.info.size;
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
      e.group.quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1, baselineY: penY });
      penX += e.advance;
    }
    maxLineWidth = Math.max(maxLineWidth, line.width);
    penY += line.height;
  }

  return {
    groups: [...ctx.groups.values()],
    bounds: { width: maxLineWidth, height: penY - origin.y },
  };
}
