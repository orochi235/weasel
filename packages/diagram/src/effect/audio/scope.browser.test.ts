import { createAnalyserTap } from '@weasel-js/audio';
import { describe, expect, it } from 'vitest';
import { drawScope, drawSpectrum } from './scope';

const SIZE = { width: 48, height: 24 };
const RATE = 48000;

/** Renders a 1 kHz sine and draws both previews from the analyser at 0.1 s. */
async function draw() {
  const ctx = new OfflineAudioContext(1, RATE * 0.2, RATE);
  const osc = ctx.createOscillator();
  osc.frequency.value = 1000;
  osc.start();
  osc.connect(ctx.destination);
  const tap = createAnalyserTap(ctx, osc);
  let out: { scope: ImageBitmap; spectrum: ImageBitmap } | undefined;
  void ctx.suspend(0.1).then(() => {
    out = { scope: drawScope(tap, SIZE), spectrum: drawSpectrum(tap, SIZE) };
    return ctx.resume();
  });
  await ctx.startRendering();
  return out!;
}

function pixels(bitmap: ImageBitmap) {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext('2d')!;
  g.drawImage(bitmap, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  return { w: c.width, h: c.height, alpha: (x: number, y: number) => data[(y * c.width + x) * 4 + 3]! };
}

describe('audio previews', () => {
  it('draws a scope at twice the size with the line away from mid-height in the middle column', async () => {
    const { scope } = await draw();
    expect([scope.width, scope.height]).toEqual([96, 48]);
    const p = pixels(scope);
    const x = p.w >> 1;
    const away = Array.from({ length: p.h }, (_, y) => y).filter((y) => p.alpha(x, y) === 255 && Math.abs(y - p.h / 2) > 4);
    expect(away.length).toBeGreaterThan(0);
  });

  it('draws the tallest spectrum bar in the bucket holding 1 kHz', async () => {
    const { spectrum } = await draw();
    const p = pixels(spectrum);
    // bands() splits the bins evenly, so a bucket spans nyquist / 32 of frequency.
    const bucket = Math.floor(1000 / (RATE / 2 / 32));
    const top = (b: number) => {
      const x = Math.floor(((b + 0.4) * p.w) / 32);
      for (let y = 0; y < p.h; y += 1) if (p.alpha(x, y) > 0) return y;
      return p.h;
    };
    const tops = Array.from({ length: 32 }, (_, b) => top(b));
    expect(tops.indexOf(Math.min(...tops))).toBe(bucket);
  });
});
