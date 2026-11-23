import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@weasel-js/core', () => ({
  createCanvasReader: () => ({ region: () => inFlight, pixel: () => null }),
  regionOnCanvas: () => ({ x: 0, y: 0, width: 1, height: 1 }),
}));

let inFlight: Promise<ImageData>;
const { createPixelReadback } = await import('./pixelReadback');

afterEach(() => vi.unstubAllGlobals());

describe('pixel readback', () => {
  it('stays quiet when a read in flight fails after it is disposed', async () => {
    let reject!: (e: unknown) => void;
    inFlight = new Promise((_, r) => { reject = r; });
    vi.stubGlobal('createImageBitmap', vi.fn());
    const settled = vi.fn();
    const pixels = createPixelReadback(document.createElement('canvas'), () => undefined, settled);
    pixels.land();
    pixels.read({ x: 0, y: 0 }, 10, 10, 2);
    pixels.dispose();
    reject(new Error('context lost'));
    await new Promise((r) => setTimeout(r, 0));
    expect(settled).not.toHaveBeenCalled();
  });
});
