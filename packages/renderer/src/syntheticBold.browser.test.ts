/**
 * Text faked bold shares a draw with text that is not: the threshold shift
 * rides each glyph's vertices. Against real WebGL2 and the real Inter atlas,
 * each has to come out as it does drawn alone. The recorder sees the shift on
 * the vertex and never the coverage it produces.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import metricsUrl from '../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../assets/fonts/inter/inter.png?url';

const FAMILY = 'synthetic-bold-inter';
const W = 96;
const H = 48;
const HALF = W / 2;

let renderer: WeaselRenderer | undefined;

// Only the regular weight, so asking for 700 fakes it.
beforeAll(async () => {
  await registerFont(FAMILY, { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
});

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

const label = (x: number, fontWeight: number): DrawCommand => ({
  kind: 'text', x, y: 8,
  runs: [{
    text: 'H', fontFamily: FAMILY, fontSize: 28, fontWeight, fontStyle: 'normal',
    fill: { paint: { kind: 'solid', color: '#ffffff' } }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  }],
  style: {},
});

/** Ink in the left and right halves of the frame, in whole pixels of coverage. */
function ink(commands: DrawCommand[]): { left: number; right: number; draws: number } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer?.dispose();
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  let draws = 0;
  const drawElements = gl.drawElements.bind(gl);
  gl.drawElements = (...args: Parameters<typeof drawElements>): void => {
    draws++;
    drawElements(...args);
  };
  renderer.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let left = 0;
  let right = 0;
  for (let i = 0; i < W * H; i++) {
    const a = px[i * 4 + 3] / 255;
    if (i % W < HALF) left += a;
    else right += a;
  }
  return { left, right, draws };
}

describe('synthetic bold beside regular text, in a real context', () => {
  it('draws both in one call, each as it comes out alone', () => {
    const regular = ink([label(8, 400)]);
    const bold = ink([label(HALF + 8, 700)]);
    const both = ink([label(8, 400), label(HALF + 8, 700)]);
    expect(both.draws).toBe(1);
    expect(regular.left).toBeGreaterThan(20);
    expect(both.left).toBeCloseTo(regular.left, 1);
    expect(both.right).toBeCloseTo(bold.right, 1);
    // Thicker by a real margin, so a shift that never reached the shader fails.
    expect(bold.right).toBeGreaterThan(regular.left * 1.1);
  });
});
