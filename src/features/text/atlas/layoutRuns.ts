/**
 * Runs-aware MSDF layout. Walks `ResolvedRun[]` codepoint-by-codepoint,
 * switching atlas per run via `resolveFontVariant`, applying kerning
 * (using the left glyph's atlas table and size scaling, including across
 * run boundaries), and bucketing emitted quads by
 * `(family, resolvedWeight, resolvedStyle, syntheticBold, syntheticItalic, fillKey)`
 * so the renderer issues one draw call per atlas+color group.
 *
 * Single-line layout in this entry point: `maxWidth: Infinity` is the
 * only supported value. Word wrap and multi-line baseline computation
 * land in a sibling task and reuse the same kerning/grouping engine.
 */

import type { Paint } from 'core/paint-types';
import type { BmFontChar, BmFont } from './FontAtlas';
import type { ResolvedRun } from '../runs/resolveRuns';
import { resolveFontVariant, type ResolveResult } from './registerFont';

export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
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
  // opts.maxWidth and opts.lineHeight and opts.align are not used in this
  // single-line core; Task 3 wraps this body with word-wrap + multi-line.
  void opts;

  const ctx: LayoutContext = { groups: new Map() };
  let penX = origin.x;
  const penY = origin.y;

  let prevCp: number | undefined;
  let prevFont: BmFont | undefined;
  let prevFontSize: number | undefined;
  let maxY = origin.y;

  for (const run of runs) {
    const resolved = resolveFontVariant(run.fontFamily, run.fontWeight, run.fontStyle);
    if (!resolved.entry) {
      prevCp = undefined;
      prevFont = undefined;
      prevFontSize = undefined;
      continue;
    }
    const font = resolved.entry.font;
    const scale = run.fontSize / font.info.size;
    const atlasW = font.common.scaleW;
    const atlasH = font.common.scaleH;
    const group = getOrCreateGroup(ctx, run, resolved);

    for (const ch of [...run.text]) {
      const cp = ch.codePointAt(0)!;
      const glyph = resolveGlyph(font, cp);
      if (!glyph) {
        prevCp = cp;
        prevFont = font;
        prevFontSize = run.fontSize;
        continue;
      }

      if (prevCp !== undefined && prevFont !== undefined && prevFontSize !== undefined) {
        const kAtlas = prevFont.kerningMap.get(prevCp)?.get(cp) ?? 0;
        penX += kAtlas * (prevFontSize / prevFont.info.size);
      }

      const qx0 = penX + glyph.xoffset * scale;
      const qy0 = penY + glyph.yoffset * scale;
      const qx1 = qx0 + glyph.width * scale;
      const qy1 = qy0 + glyph.height * scale;
      const u0 = glyph.x / atlasW;
      const v0 = glyph.y / atlasH;
      const u1 = (glyph.x + glyph.width) / atlasW;
      const v1 = (glyph.y + glyph.height) / atlasH;
      group.quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1 });

      maxY = Math.max(maxY, qy1);
      penX += glyph.xadvance * scale;
      prevCp = cp;
      prevFont = font;
      prevFontSize = run.fontSize;
    }
  }

  return {
    groups: [...ctx.groups.values()],
    bounds: { width: penX - origin.x, height: maxY - origin.y },
  };
}
