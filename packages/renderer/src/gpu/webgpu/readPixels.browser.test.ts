/**
 * `WeaselRenderer.readPixels` on both backends: the canvas's last frame, top
 * rows first, multisampled or not, read after the frame has been shown.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DrawCommand } from '../../DrawCommand';
import { closeBackends, openBackends, releaseDevice, requireGpu } from '../../testing/parityHarness';

const W = 40;
const H = 30;

const rect = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width: w, height: h }, fill: { paint: { color } },
});

/** Red across the top ten rows, blue below. */
const FRAME = [rect(0, 0, W, 10, '#ff0000'), rect(0, 10, W, H - 10, '#0000ff')];

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

afterAll(() => releaseDevice());
beforeEach(requireGpu);
afterEach(() => closeBackends());

describe('WeaselRenderer.readPixels', () => {
  for (const antialias of [false, true]) {
    it(`reads the last frame top rows first, ${antialias ? 'multisampled' : 'single-sampled'}`, async () => {
      const b = await openBackends({ width: W, height: H, dpr: 1, antialias });
      for (const renderer of [b.gl, b.gpu]) {
        renderer.render(FRAME);
        await nextFrame();
        const px = await renderer.readPixels({ x: 4, y: 6, width: 2, height: 8 });
        expect(px.length).toBe(2 * 8 * 4);
        // Rows 6–9 red, 10–13 blue.
        expect(Array.from(px.subarray(0, 4)), renderer.backend).toEqual([255, 0, 0, 255]);
        expect(Array.from(px.subarray(7 * 8, 7 * 8 + 4)), renderer.backend).toEqual([0, 0, 255, 255]);
      }
    });
  }

  it('answers at once on WebGL, and refuses to on WebGPU', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    b.gl.render(FRAME);
    expect(Array.from(b.gl.readPixelsSync({ x: 0, y: 29, width: 1, height: 1 }))).toEqual([0, 0, 255, 255]);
    expect(() => b.gpu.readPixelsSync({ x: 0, y: 0, width: 1, height: 1 })).toThrow(/only through readPixels/);
  });

  it('refuses a rect outside the canvas', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    expect(() => b.gl.readPixels({ x: 39, y: 0, width: 2, height: 1 })).toThrow(RangeError);
  });
});
