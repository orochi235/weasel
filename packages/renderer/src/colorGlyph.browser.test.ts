/**
 * Emoji read back from a real context: whether they come out in their own
 * colors, and whether a cluster of several code points comes out as one glyph.
 * The recorder sees the quad and never the texel, and jsdom has no canvas to
 * rasterize a glyph from.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerCanvasFont } from '@weasel-js/font';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

const W = 160;
const H = 64;
const SIZE = 40;
const BLUE = '#0000ff';

/** Whether this machine draws a color glyph for an emoji at all. Without an emoji font there is nothing to check. */
function platformDrawsColorEmoji(): boolean {
  const ctx = new OffscreenCanvas(64, 64).getContext('2d')!;
  ctx.font = '48px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('👍', 4, 52);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 128 && Math.min(data[i], data[i + 1], data[i + 2]) < 200) return true;
  }
  return false;
}

let renderer: WeaselRenderer | undefined;

beforeAll(() => registerCanvasFont('sans-serif'));

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

interface Ink {
  /** Solidly inked pixels, as straight RGB. */
  pixels: number[][];
  /** Columns the ink spans. */
  width: number;
  /** The lowest inked row of the pixels `test` holds for, top-left origin. */
  bottomOf(test: (rgb: number[]) => boolean): number;
}

function paint(text: string): Ink {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  const command: DrawCommand = {
    kind: 'text', x: 8, y: 8,
    runs: [{
      text, fontFamily: 'sans-serif', fontSize: SIZE, fontWeight: 400, fontStyle: 'normal',
      fill: { paint: { kind: 'solid', color: BLUE } }, letterSpacing: 0,
      underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }],
    style: {},
  };
  renderer.render([command]);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const pixels: number[][] = [];
  const rows: number[] = [];
  let x0 = W;
  let x1 = -1;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 250) continue;
    pixels.push([px[i], px[i + 1], px[i + 2]]);
    rows.push(H - 1 - Math.floor(i / 4 / W));
    const x = (i / 4) % W;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  return {
    pixels,
    width: Math.max(0, x1 - x0 + 1),
    bottomOf: (test) => Math.max(-1, ...rows.filter((_, i) => test(pixels[i]))),
  };
}

const isBlue = ([r, g, b]: number[]) => r < 40 && g < 40 && b > 200;
const share = (ink: Ink, test: (rgb: number[]) => boolean) => ink.pixels.filter(test).length / Math.max(1, ink.pixels.length);
const mean = (ink: Ink) => [0, 1, 2].map((c) => ink.pixels.reduce((sum, p) => sum + p[c], 0) / Math.max(1, ink.pixels.length));

describe.skipIf(!platformDrawsColorEmoji())('an emoji, in a real context', () => {
  it('paints text in the fill color, which is what an emoji is being told apart from', () => {
    const ink = paint('H');
    expect(ink.pixels.length).toBeGreaterThan(50);
    expect(share(ink, isBlue)).toBe(1);
  });

  it('paints an emoji in its own colors, not the fill', () => {
    const ink = paint('👍');
    expect(ink.pixels.length).toBeGreaterThan(200);
    expect(share(ink, isBlue)).toBeLessThan(0.05);
    // A yellow hand: red and green well over blue.
    const [r, g, b] = mean(ink);
    expect(r).toBeGreaterThan(b + 40);
    expect(g).toBeGreaterThan(b + 20);
  });

  it('sets an emoji on the baseline of the text beside it', () => {
    const ink = paint('H👍');
    const baseline = ink.bottomOf(isBlue);
    const emojiBottom = ink.bottomOf((rgb) => !isBlue(rgb));
    // An emoji reaches a little under the baseline, as a descender does.
    expect(emojiBottom).toBeGreaterThanOrEqual(baseline);
    expect(emojiBottom).toBeLessThan(baseline + SIZE * 0.3);
  });

  it('paints an emoji and its skin tone as one glyph in that tone', () => {
    const plain = paint('👍');
    renderer?.dispose();
    const toned = paint('👍🏽');
    expect(toned.width).toBeLessThan(plain.width * 1.3);
    expect(toned.width).toBeGreaterThan(plain.width * 0.7);
    // Medium skin is darker than the default yellow.
    expect(mean(toned)[1]).toBeLessThan(mean(plain)[1] - 15);
  });

  it('paints a flag as one glyph, not as two letters', () => {
    const single = paint('👍');
    renderer?.dispose();
    const flag = paint('🇨🇦');
    expect(flag.width).toBeLessThan(single.width * 1.5);
    expect(share(flag, ([r, g, b]) => r > 180 && g < 90 && b < 90)).toBeGreaterThan(0.2);
    expect(share(flag, isBlue)).toBeLessThan(0.05);
  });

  it('paints a joined family as one glyph, not as three people', () => {
    const single = paint('👍');
    renderer?.dispose();
    const family = paint('👨‍👩‍👧');
    expect(family.width).toBeLessThan(single.width * 1.5);
    expect(share(family, isBlue)).toBeLessThan(0.05);
  });
});
