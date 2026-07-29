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
 * On BAKE_SIZE — measured 2026-07-29, comparing the reconstructed field
 * against a direct `fillText` of the same glyph at each display size, with
 * sub-pixel registration searched out so it measures fidelity and not
 * alignment. Mean per-pixel coverage error, averaged over A/S/e/W/8:
 *
 *   display px   12     16     24     32     48     64     96     128
 *   error        .096   .083   .059   .039   .024   .023   .037   .049
 *
 * Two things follow, both of them counterintuitive enough to be worth
 * writing down. The error is minimized *at* the bake size, so raising
 * BAKE_SIZE does not improve small text — it moves the sweet spot away from
 * the 12–32px range where UI text actually lives and makes it worse. And the
 * magnification side is the mild one: 128px costs about twice the floor,
 * which is the corner rounding the shader header already owns.
 *
 * The 12–16px end is the largest divergence, and it is not undersampling —
 * 3×3 supersampling the reconstruction roughly halves the error at 24–48px
 * but recovers almost nothing at 12–16px (.096 → .089, .083 → .068). What is
 * left there is a hinted rasterizer placing stems on the pixel grid, which no
 * size-independent field can encode. So there is nothing to buy with more
 * taps, a bigger bake, or mipmaps (which a packed atlas cannot have anyway —
 * mip levels blend across glyph rects).
 */

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

export interface GlyphRasterizer {
  faceMetrics(family: string, weight: number, style: 'normal' | 'italic'): FaceMetrics;
  rasterize(
    family: string, weight: number, style: 'normal' | 'italic', codepoint: number,
  ): RasterizedGlyph;
}

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function cssFontString(weight: number, style: 'normal' | 'italic', family: string): string {
  return `${style === 'italic' ? 'italic ' : ''}${weight} ${BAKE_SIZE}px ${JSON.stringify(family)}`;
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

  function setFont(family: string, weight: number, style: 'normal' | 'italic'): void {
    ctx!.font = cssFontString(weight, style, family);
    ctx!.textBaseline = 'alphabetic';
    ctx!.textAlign = 'left';
  }

  return {
    faceMetrics(family, weight, style) {
      setFont(family, weight, style);
      const m = ctx!.measureText('Hg');
      return {
        ascent: m.fontBoundingBoxAscent ?? BAKE_SIZE * 0.8,
        descent: m.fontBoundingBoxDescent ?? BAKE_SIZE * 0.2,
      };
    },

    rasterize(family, weight, style, codepoint) {
      setFont(family, weight, style);
      const chStr = String.fromCodePoint(codepoint);
      const m = ctx!.measureText(chStr);
      const advance = m.width;
      const inkLeft = Math.ceil(m.actualBoundingBoxLeft ?? 0);
      const inkRight = Math.ceil(m.actualBoundingBoxRight ?? advance);
      const inkAscent = Math.ceil(m.actualBoundingBoxAscent ?? BAKE_SIZE * 0.8);
      const inkDescent = Math.ceil(m.actualBoundingBoxDescent ?? BAKE_SIZE * 0.2);
      const inkW = inkLeft + inkRight;
      const inkH = inkAscent + inkDescent;
      if (inkW <= 0 || inkH <= 0) {
        return { width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance };
      }
      const w = inkW + 2 * PAD;
      const h = inkH + 2 * PAD;
      if (canvas.width < w || canvas.height < h) {
        canvas.width = Math.max(canvas.width, w);
        canvas.height = Math.max(canvas.height, h);
        setFont(family, weight, style); // resizing resets 2D state
      }
      ctx!.clearRect(0, 0, w, h);
      ctx!.fillStyle = '#fff';
      ctx!.fillText(chStr, PAD + inkLeft, PAD + inkAscent);
      const img = ctx!.getImageData(0, 0, w, h);
      const alpha = new Uint8ClampedArray(w * h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = img.data[i * 4 + 3];
      return {
        width: w,
        height: h,
        alpha,
        left: -(inkLeft + PAD),
        top: inkAscent + PAD,
        advance,
      };
    },
  };
}
