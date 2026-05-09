/**
 * MSDF glyph layout — pure function, no GL dependency.
 *
 * layoutGlyphs walks the text string codepoint-by-codepoint, looks up each
 * glyph in the BmFont charMap, applies kerning from kerningMap, and emits
 * one GlyphQuad per rendered glyph. Unknown codepoints fall back to '?' (63);
 * if '?' is also absent, the glyph is skipped with a console.warn.
 *
 * TODO(harfbuzz): complex script shaping deferred — requires HarfBuzz WASM.
 */

import type { BmFont, BmFontChar } from './FontAtlas';

export interface GlyphQuad {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface GlyphLayoutStyle {
  fontSize: number;
  align: 'left' | 'center' | 'right';
  baseline?: 'alphabetic' | 'top' | 'middle';
}

export interface GlyphLayoutOrigin {
  x: number;
  y: number;
}

const FALLBACK_CODEPOINT = 63; // '?'

export function layoutGlyphs(
  text: string,
  style: GlyphLayoutStyle,
  font: BmFont,
  origin: GlyphLayoutOrigin = { x: 0, y: 0 },
): GlyphQuad[] {
  const scale = style.fontSize / font.info.size;
  const atlasW = font.common.scaleW;
  const atlasH = font.common.scaleH;

  const quads: GlyphQuad[] = [];
  let penX = origin.x;
  const penY = origin.y;

  const codepoints = [...text].map((ch) => ch.codePointAt(0)!);

  let prevCp: number | undefined;
  for (const cp of codepoints) {
    let glyph: BmFontChar | undefined = font.charMap.get(cp);

    if (!glyph) {
      const fb = font.charMap.get(FALLBACK_CODEPOINT);
      if (!fb) {
        console.warn(
          `weasel-gl text: no glyph for codepoint ${cp} and no fallback '?'; skipping.`,
        );
        prevCp = cp;
        continue;
      }
      glyph = fb;
    }

    if (prevCp !== undefined) {
      const kern = font.kerningMap.get(prevCp)?.get(cp) ?? 0;
      penX += kern * scale;
    }

    const qx0 = penX + glyph.xoffset * scale;
    const qy0 = penY + glyph.yoffset * scale;
    const qx1 = qx0 + glyph.width * scale;
    const qy1 = qy0 + glyph.height * scale;

    const u0 = glyph.x / atlasW;
    const v0 = glyph.y / atlasH;
    const u1 = (glyph.x + glyph.width) / atlasW;
    const v1 = (glyph.y + glyph.height) / atlasH;

    quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1 });

    penX += glyph.xadvance * scale;
    prevCp = cp;
  }

  return quads;
}

export function quadsToVertexBuffer(quads: GlyphQuad[]): Float32Array {
  const out = new Float32Array(quads.length * 4 * 4);
  let i = 0;
  for (const q of quads) {
    out[i++] = q.x0; out[i++] = q.y0; out[i++] = q.u0; out[i++] = q.v0;
    out[i++] = q.x1; out[i++] = q.y0; out[i++] = q.u1; out[i++] = q.v0;
    out[i++] = q.x0; out[i++] = q.y1; out[i++] = q.u0; out[i++] = q.v1;
    out[i++] = q.x1; out[i++] = q.y1; out[i++] = q.u1; out[i++] = q.v1;
  }
  return out;
}

export function buildQuadIndexBuffer(quadCount: number): Uint32Array {
  const out = new Uint32Array(quadCount * 6);
  let i = 0;
  for (let q = 0; q < quadCount; q++) {
    const base = q * 4;
    out[i++] = base;     out[i++] = base + 1; out[i++] = base + 2;
    out[i++] = base + 1; out[i++] = base + 3; out[i++] = base + 2;
  }
  return out;
}
