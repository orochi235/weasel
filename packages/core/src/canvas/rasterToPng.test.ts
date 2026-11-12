import { afterEach, describe, expect, it, vi } from 'vitest';
import { rasterToPng } from './rasterToPng';

const setupGetContext = HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = setupGetContext;
  vi.restoreAllMocks();
});

describe('rasterToPng', () => {
  it('encodes on a page canvas where there is no OffscreenCanvas', async () => {
    expect(typeof OffscreenCanvas).toBe('undefined');
    const putImageData = vi.fn();
    HTMLCanvasElement.prototype.getContext = ((kind: string) => (kind === '2d' ? { putImageData } : null)) as HTMLCanvasElement['getContext'];
    const png = new Blob(['png'], { type: 'image/png' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(png));
    const out = await rasterToPng({ width: 2, height: 1, data: new Uint8ClampedArray(8) });
    expect(out).toBe(png);
    expect(putImageData).toHaveBeenCalledTimes(1);
  });
});
