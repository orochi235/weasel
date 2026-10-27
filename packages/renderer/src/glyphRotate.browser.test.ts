/**
 * A turned run's glyphs come out turned about their pens, against real WebGL2
 * and the real Inter atlas and outlines. The recorder sees the turned corners;
 * only the framebuffer shows the atlas sampled the right way round inside them.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerFont, registerFontOutlines, loadFontOutlines } from '@weasel-js/font';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import metricsUrl from '../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../assets/fonts/inter/inter.ttf?url';

const ATLAS = 'glyph-rotate-inter';
const OUTLINE = 'glyph-rotate-inter-outline';
const W = 96;
const H = 96;

let renderer: WeaselRenderer | undefined;

beforeAll(async () => {
  await registerFont(ATLAS, { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
  // Outlines and no atlas, so every glyph is drawn on the outline tier.
  registerFontOutlines(OUTLINE, { weight: 400 }, ttfUrl);
  await loadFontOutlines(OUTLINE, { weight: 400 });
});

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

const glyph = (fontFamily: string, rotate?: number): DrawCommand => ({
  kind: 'text', x: 30, y: 10,
  runs: [{
    text: 'l', fontFamily, fontSize: 40, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { kind: 'solid', color: '#ffffff' } }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
    ...(rotate ? { rotate } : {}),
  }],
  style: {},
});

/** The box of the pixels inked past half coverage, y down. */
function inkBox(cmd: DrawCommand): { minX: number; minY: number; maxX: number; maxY: number } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer?.dispose();
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderer.render([cmd]);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let i = 0; i < W * H; i++) {
    if (px[i * 4 + 3] < 128) continue;
    const x = i % W, y = H - 1 - Math.floor(i / W);
    box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
  }
  return box;
}

describe('turned glyphs in a real context', () => {
  for (const [tier, family] of [['atlas', ATLAS], ['outline', OUTLINE]] as const) {
    it(`turns an ${tier} glyph a quarter clockwise about its pen, below the baseline`, () => {
      const up = inkBox(glyph(family));
      const turned = inkBox(glyph(family, 90));
      const upW = up.maxX - up.minX, upH = up.maxY - up.minY;
      const tW = turned.maxX - turned.minX, tH = turned.maxY - turned.minY;
      expect(upH).toBeGreaterThan(20);
      expect(upH).toBeGreaterThan(3 * upW);
      // Lying down: as long as the upright stroke was tall, and as thick as it was wide.
      expect(tW).toBeGreaterThan(3 * tH);
      expect(Math.abs(tW - upH)).toBeLessThanOrEqual(2);
      // The upright stroke stands on the baseline; turned, it hangs just below it.
      expect(turned.minY).toBeGreaterThanOrEqual(up.maxY - 1);
      expect(turned.minY - up.maxY).toBeLessThan(8);
      // Its foot stays at the pen, so it reaches right from where the upright one stood.
      expect(turned.minX).toBeGreaterThanOrEqual(up.minX - 8);
      expect(turned.maxX).toBeGreaterThan(up.maxX + 15);
    });
  }
});
