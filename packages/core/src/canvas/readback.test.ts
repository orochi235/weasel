import { describe, it, expect, vi } from 'vitest';
import { createCanvasReader, readGl, regionAround } from './readback';

const core = vi.hoisted(() => ({ backend: 'webgl2' as 'webgl2' | 'webgpu', reads: [] as unknown[] }));
vi.mock('./canvasBackend', () => ({ canvasPaintsWith: () => core.backend }));
vi.mock('./readCanvasPixels', () => ({
  readCanvasPixels: (_c: unknown, rect: { width: number; height: number }) => {
    core.reads.push(rect);
    const bytes = new Uint8Array(rect.width * rect.height * 4);
    for (let i = 0; i < bytes.length; i += 4) bytes.set([i / 4, 10, 20, 255], i);
    return Promise.resolve(bytes);
  },
}));

describe('regionAround', () => {
  it('centers the region on the pointer, in device pixels', () => {
    // device center = (200, 100); region 40x20 → (180, 90)
    expect(regionAround({ x: 0, y: 0, width: 800, height: 600 }, { x: 100, y: 50 }, 2, 40, 20))
      .toEqual({ x: 180, y: 90, width: 40, height: 20 });
  });

  it('clamps the region to the drawing buffer', () => {
    expect(regionAround({ x: 0, y: 0, width: 800, height: 600 }, { x: 0, y: 0 }, 1, 40, 20))
      .toMatchObject({ x: 0, y: 0 });
  });

  it('offsets the region by the target rect and clamps inside it', () => {
    const pane = { x: 420, y: 20, width: 380, height: 360 };
    // center (520, 70) → (500, 60)
    expect(regionAround(pane, { x: 100, y: 50 }, 1, 40, 20)).toMatchObject({ x: 500, y: 60 });
    // pinned to the pane's far corner
    expect(regionAround(pane, { x: 370, y: 355 }, 1, 40, 20)).toMatchObject({ x: 760, y: 360 });
  });
});

describe('readGl', () => {
  it('reads from the bottom-left origin and flips the rows back to top-down', () => {
    const calls: number[][] = [];
    const gl = {
      RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
      readPixels: (x: number, y: number, w: number, h: number, _f: number, _t: number, buf: Uint8Array) => {
        calls.push([x, y, w, h]);
        // GL row 0 (bottom) red; GL row h-1 (top) blue.
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const i = (row * w + col) * 4;
            buf[i] = row === 0 ? 255 : 0;
            buf[i + 2] = row === h - 1 ? 255 : 0;
            buf[i + 3] = 255;
          }
        }
      },
    } as unknown as WebGL2RenderingContext;
    const img = readGl(gl, 600, { x: 180, y: 90, width: 2, height: 2 });
    expect(calls[0]).toEqual([180, 600 - 90 - 2, 2, 2]);
    // ImageData row 0 must be GL row h-1 → blue.
    expect(img.data[2]).toBe(255);
    expect(img.data[0]).toBe(0);
  });
});

describe('createCanvasReader on WebGPU', () => {
  it('reads a region back asynchronously, and answers a pixel inside it from that read', async () => {
    core.backend = 'webgpu';
    const reader = createCanvasReader(document.createElement('canvas'));
    expect(reader.pixel({ x: 11, y: 21, width: 1, height: 1 })).toBeNull();
    const region = reader.region({ x: 10, y: 20, width: 3, height: 2 });
    expect(region).toBeInstanceOf(Promise);
    const data = await region!;
    expect([data.width, data.height]).toEqual([3, 2]);
    // (11, 21) is the region's fifth pixel: row 1, column 1.
    expect(Array.from(reader.pixel({ x: 11, y: 21, width: 1, height: 1 })!)).toEqual([4, 10, 20, 255]);
    expect(reader.pixel({ x: 13, y: 21, width: 1, height: 1 })).toBeNull();
    expect(core.reads).toEqual([{ x: 10, y: 20, width: 3, height: 2 }]);
    core.backend = 'webgl2';
  });
});
