/**
 * Canvas-2D glyph rasterizer for the dynamic SDF atlas. `fillText` is the
 * only web-platform route to *installed* machine fonts (no outline access),
 * which is exactly why this tier exists.
 *
 * Coordinate contract (all values in bake-size px, i.e. at BAKE_SIZE):
 *   bitmap left  = penX + left      (left is negative: pad + left bearing)
 *   bitmap top   = baseline − top   (top is positive above the baseline)
 *   pen advance  = advance
 * The bitmap includes a PAD border on all four sides so the SDF field has
 * room to fall off. Blank glyphs (e.g. space) return width/height 0.
 *
 * On BAKE_SIZE: mean per-pixel coverage error of the reconstructed field
 * against a direct `fillText` of the same glyph at each display size:
 *
 *   display px   12     16     24     32     48     64     96     128
 *   error        .096   .083   .059   .039   .024   .023   .037   .049
 *
 * The error is minimized *at* the bake size, so raising BAKE_SIZE does not
 * improve small text — it moves the sweet spot away from the 12–32px range
 * and makes it worse. The 12–16px error is not undersampling: supersampling
 * the reconstruction recovers almost nothing there. What is left is a hinted
 * rasterizer placing stems on the pixel grid, which no size-independent field
 * can encode, so more taps, a bigger bake, or mipmaps buy nothing.
 */

import type { FontStyle } from '../fontStyle';
import { cssFamilyName } from '../cssFamily';

export const BAKE_SIZE = 48;
export const PAD = 8;

export interface FaceMetrics {
  ascent: number;
  descent: number;
}

export interface RasterizedGlyph {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
  left: number;
  top: number;
  advance: number;
}

/** A glyph in its own colors. Placed as a {@link RasterizedGlyph} is. */
export interface RasterizedColorGlyph {
  width: number;
  height: number;
  /** Premultiplied RGBA, four bytes a texel. */
  rgba: Uint8ClampedArray;
  left: number;
  top: number;
  advance: number;
}

export interface GlyphRasterizer {
  faceMetrics(family: string, weight: number, style: FontStyle): FaceMetrics;
  rasterize(
    family: string, weight: number, style: FontStyle, codepoint: number,
  ): RasterizedGlyph;
  /** `text`, one grapheme cluster, as the color glyph the platform draws for
   *  it, or null when it draws none: no ink, or ink in the fill color alone.
   *  Drawn at `size` px, `BAKE_SIZE` when omitted, and measured in its px. */
  rasterizeColor?(
    family: string, weight: number, style: FontStyle, text: string, size?: number,
  ): RasterizedColorGlyph | null;
  /** `d`, em-space SVG path data with y down and its origin on the baseline at the pen, filled
   *  at `BAKE_SIZE` px: the glyphs a shaper chose, which `fillText` cannot address. Its
   *  `advance` is 0; the shaping has the advance. */
  rasterizePath?(d: string): RasterizedGlyph;
}

/** `[minX, minY, maxX, maxY]` over every coordinate pair in path data whose commands take only
 *  absolute pairs (M, L, Q, C, Z): its control points, which hold the outline. */
export function pathBounds(d: string): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  for (let k = 0; k + 1 < nums.length; k += 2) {
    const x = Number(nums[k]), y = Number(nums[k + 1]);
    if (x < b[0]) b[0] = x;
    if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x;
    if (y > b[3]) b[3] = y;
  }
  return b;
}

/** Ink this far below white did not come from the white fill. */
const COLORED_BELOW = 240;

/** `data`, straight RGBA drawn with a white fill, premultiplied. Null when
 *  every inked texel is the fill's white: a glyph with no color of its own. */
export function premultipliedColor(data: Uint8ClampedArray): Uint8ClampedArray | null {
  const out = new Uint8ClampedArray(data.length);
  let colored = false;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (a >= 128 && Math.min(r, g, b) < COLORED_BELOW) colored = true;
    out[i] = Math.round((r * a) / 255);
    out[i + 1] = Math.round((g * a) / 255);
    out[i + 2] = Math.round((b * a) / 255);
    out[i + 3] = a;
  }
  return colored ? out : null;
}

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** Engines report font-box metrics in whole pixels, so they are read at a
 *  size where that rounding is a thousandth of an em, not a fiftieth. */
const METRICS_SIZE = 1000;

function cssFontString(weight: number, style: FontStyle, family: string, size = BAKE_SIZE): string {
  return `${style === 'italic' ? 'italic ' : ''}${weight} ${size}px ${cssFamilyName(family)}`;
}

export function createCanvasRasterizer(): GlyphRasterizer {
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(BAKE_SIZE * 3, BAKE_SIZE * 3);
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = BAKE_SIZE * 3;
    canvas.height = BAKE_SIZE * 3;
  } else {
    throw new Error('weasel DynamicGlyphAtlas: no canvas available for glyph rasterization');
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Canvas2D | null;
  if (!ctx) throw new Error('weasel DynamicGlyphAtlas: 2D context unavailable');

  function setFont(family: string, weight: number, style: FontStyle, size = BAKE_SIZE): void {
    ctx!.font = cssFontString(weight, style, family, size);
    ctx!.textBaseline = 'alphabetic';
    ctx!.textAlign = 'left';
  }

  /** `text` filled in white at `size` px, as straight RGBA. No ink is a box of no size. */
  function draw(family: string, weight: number, style: FontStyle, text: string, size = BAKE_SIZE): {
    data: Uint8ClampedArray; width: number; height: number; left: number; top: number; advance: number;
  } {
    setFont(family, weight, style, size);
    const m = ctx!.measureText(text);
    const advance = m.width;
    const inkLeft = Math.ceil(m.actualBoundingBoxLeft ?? 0);
    const inkRight = Math.ceil(m.actualBoundingBoxRight ?? advance);
    const inkAscent = Math.ceil(m.actualBoundingBoxAscent ?? size * 0.8);
    const inkDescent = Math.ceil(m.actualBoundingBoxDescent ?? size * 0.2);
    const inkW = inkLeft + inkRight;
    const inkH = inkAscent + inkDescent;
    if (inkW <= 0 || inkH <= 0) {
      return { data: new Uint8ClampedArray(0), width: 0, height: 0, left: 0, top: 0, advance };
    }
    const w = inkW + 2 * PAD;
    const h = inkH + 2 * PAD;
    if (canvas.width < w || canvas.height < h) {
      canvas.width = Math.max(canvas.width, w);
      canvas.height = Math.max(canvas.height, h);
      setFont(family, weight, style, size); // resizing resets 2D state
    }
    ctx!.clearRect(0, 0, w, h);
    ctx!.fillStyle = '#fff';
    ctx!.fillText(text, PAD + inkLeft, PAD + inkAscent);
    return {
      data: ctx!.getImageData(0, 0, w, h).data,
      width: w, height: h, left: -(inkLeft + PAD), top: inkAscent + PAD, advance,
    };
  }

  return {
    faceMetrics(family, weight, style) {
      setFont(family, weight, style, METRICS_SIZE);
      const m = ctx!.measureText('Hg');
      const k = BAKE_SIZE / METRICS_SIZE;
      return {
        ascent: (m.fontBoundingBoxAscent ?? METRICS_SIZE * 0.8) * k,
        descent: (m.fontBoundingBoxDescent ?? METRICS_SIZE * 0.2) * k,
      };
    },

    rasterize(family, weight, style, codepoint) {
      const { data, ...box } = draw(family, weight, style, String.fromCodePoint(codepoint));
      const alpha = new Uint8ClampedArray(box.width * box.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
      return { ...box, alpha };
    },

    rasterizePath(d) {
      const [minX, minY, maxX, maxY] = pathBounds(d);
      const blank = { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 0 };
      if (!(maxX > minX && maxY > minY)) return blank;
      const x0 = Math.floor(minX * BAKE_SIZE), y0 = Math.floor(minY * BAKE_SIZE);
      const w = Math.ceil(maxX * BAKE_SIZE) - x0 + 2 * PAD;
      const h = Math.ceil(maxY * BAKE_SIZE) - y0 + 2 * PAD;
      if (canvas.width < w || canvas.height < h) {
        canvas.width = Math.max(canvas.width, w);
        canvas.height = Math.max(canvas.height, h);
      }
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      ctx!.setTransform(BAKE_SIZE, 0, 0, BAKE_SIZE, PAD - x0, PAD - y0);
      ctx!.fillStyle = '#fff';
      ctx!.fill(new Path2D(d));
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      const data = ctx!.getImageData(0, 0, w, h).data;
      const alpha = new Uint8ClampedArray(w * h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
      return { width: w, height: h, alpha, left: x0 - PAD, top: PAD - y0, advance: 0 };
    },

    rasterizeColor(family, weight, style, text, size) {
      const { data, ...box } = draw(family, weight, style, text, size);
      const rgba = premultipliedColor(data);
      return rgba && { ...box, rgba };
    },
  };
}
