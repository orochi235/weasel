/**
 * Real-GL assertion for per-codepoint font fallback. No committed baseline,
 * for the same reason as `text-aa.spec.ts`: `text.spec.ts` runs at a 5%
 * tolerance, and one wrong character is nowhere near 5% of a 600×360 canvas.
 * The old `?` substitution sat in the committed baseline for an entire commit
 * without anyone noticing, which is exactly the failure a golden image at that
 * tolerance cannot report.
 *
 * The `t4` node's text contains an em dash (U+2014). The bundled Inter MSDF
 * atlas has no glyph for it, so drawing it at all depends on the layout pass
 * escalating that one codepoint to the dynamic canvas tier.
 *
 * Shape, not pixels: an em dash is a wide, thin horizontal bar. A `?` — the
 * character the old fallback drew — is narrow and tall. The aspect ratio of
 * the ink in the gap between "editing" and "magenta" tells the two apart with
 * an enormous margin (measured: 12×2 for the dash, and a `?` at this size is
 * roughly 8×15), so this survives the glyph landing a pixel or two off.
 */
import { test, expect } from '@playwright/test';

// The gap between the two words on the `t4` line, in canvas pixels. Wide
// enough to hold the dash with clearance, tight enough to exclude the
// neighbouring glyphs.
// The dash measures x 186–197, y 260–261. "editing"'s final `g` ends at x 177
// and "magenta"'s `m` starts at x 205, so this leaves a couple of pixels of
// clearance on each side without reaching either neighbour — including the
// `g`'s descender, which is what makes the y range matter as much as the x.
const GAP = { x0: 180, x1: 203, y0: 248, y1: 278 };

test('missing glyph — an em dash the atlas lacks draws as a dash, not a "?"', async ({ page }) => {
  await page.goto('/#text');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);

  const box = await page.evaluate((GAP) => {
    const c = document.querySelector<HTMLCanvasElement>('canvas')!;
    const gl = c.getContext('webgl2')!;
    const w = c.width;
    const h = c.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // readPixels is bottom-up; this takes top-down canvas coords.
    const inkAt = (x: number, y: number) => {
      const i = ((h - 1 - y) * w + x) * 4;
      return 255 - (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]);
    };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, n = 0;
    for (let y = GAP.y0; y < GAP.y1; y++) {
      for (let x = GAP.x0; x < GAP.x1; x++) {
        if (inkAt(x, y) <= 40) continue;
        n++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return n === 0 ? null : { width: maxX - minX + 1, height: maxY - minY + 1, n };
  }, GAP);

  // Nothing at all means the escalation dropped the codepoint — the other way
  // this can regress, and the one a "not a question mark" check would miss.
  expect(box, 'no ink where the em dash should be').not.toBeNull();

  expect(box!.width).toBeGreaterThan(6);
  expect(box!.height).toBeLessThan(6);
  expect(box!.width / box!.height).toBeGreaterThan(2);
});
