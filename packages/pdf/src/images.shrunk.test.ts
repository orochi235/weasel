import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { latin1 } from './latin1';
import { NO_FONTS } from './testing/noFonts';
import type { RasterPixels } from './writePdf';
import { writePdf } from './writePdf';

const image: DrawCommand = { kind: 'image', image: { width: 2, height: 2 } as unknown as ImageBitmap, x: 10, y: 10, w: 20, h: 20 } as DrawCommand;
const blurred: DrawCommand = {
  kind: 'group',
  effects: [{ kind: 'blur', radius: 2 }],
  children: [{ kind: 'path', path: { kind: 'rect', x: 5, y: 5, width: 20, height: 20 }, fill: { paint: { color: '#00f' } } }],
} as DrawCommand;

const px = (width: number, height: number, bytes: number): RasterPixels => ({ width, height, data: new Uint8ClampedArray(bytes).fill(255) });

// Shrunk from `hostPixels.pbt.test.ts` (2026-11-11).
describe('host pixels, shrunk counterexamples', () => {
  it('leaves out and reports an image whose pixels are 1 by 0, or fewer than its size holds', async () => {
    for (const read of [px(1, 0, 16), px(2, 2, 12)]) {
      const { bytes, skipped } = await writePdf([{ width: 100, height: 100, commands: [image] }], { fonts: NO_FONTS, compress: false, readPixels: () => read });
      expect(skipped).toEqual([{ kind: 'command', detail: 'image has the wrong number of pixels' }]);
      expect(latin1(bytes)).not.toContain('/Subtype /Image');
    }
  });

  it('leaves out and reports a raster of 0 by 0', async () => {
    const { bytes, skipped } = await writePdf([{ width: 100, height: 100, commands: [blurred] }], { fonts: NO_FONTS, compress: false, rasterize: async () => px(0, 0, 0) });
    expect(skipped).toEqual([{ kind: 'command', detail: 'effects raster has the wrong number of pixels' }]);
    expect(latin1(bytes)).not.toContain('/Subtype /Image');
  });
});
