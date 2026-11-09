import { afterEach, describe, expect, it, vi } from 'vitest';
import { protectTexture } from './protectTexture';

describe('protectTexture', () => {
  it('refuses a mask of the wrong size before making a bitmap', async () => {
    await expect(protectTexture(new Uint8Array(5), 2, 3)).rejects.toThrow(RangeError);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('makes a texture for a grid of no dots, as ImageData refuses a zero size', async () => {
    const sizes: string[] = [];
    vi.stubGlobal('ImageData', class {
      constructor(data: Uint8ClampedArray, w: number, h: number) {
        if (w === 0 || h === 0 || data.length !== w * h * 4) throw new RangeError(`IndexSizeError ${w}x${h}`);
        sizes.push(`${w}x${h}`);
      }
    });
    vi.stubGlobal('createImageBitmap', async () => ({ close() {} }));
    const t = await protectTexture(new Uint8Array(0), 0, 4);
    expect(sizes).toEqual(['1x4']);
    expect([t.width, t.height]).toEqual([0, 4]);
    t.dispose();
  });
});
