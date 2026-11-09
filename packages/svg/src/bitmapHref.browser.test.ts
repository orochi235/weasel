/** A runtime bitmap exported to SVG comes back as an image a browser decodes, with its pixels. */
import { describe, expect, it } from 'vitest';
import { bitmapSrc, releaseImage } from '@weasel-js/core';
import { parseSvg, serializeSvg, type SvgImageNode } from './index';

describe('serializeSvg on a bitmapSrc image, in a browser', () => {
  it('round-trips through a PNG data URL that decodes to the same pixels', async () => {
    const off = new OffscreenCanvas(3, 2);
    const ctx = off.getContext('2d')!;
    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 3, 2);
    const bitmap = off.transferToImageBitmap();
    const src = bitmapSrc(bitmap);
    try {
      const warnings: string[] = [];
      const out = serializeSvg(
        [{ kind: 'image', href: src, x: 0, y: 0, width: 3, height: 2 }],
        { viewBox: { x: 0, y: 0, width: 3, height: 2 }, onWarn: (m) => warnings.push(m) },
      );
      expect(warnings).toEqual([]);
      const href = (parseSvg(out).nodes[0] as SvgImageNode).href;
      expect(href.startsWith('data:image/png;base64,')).toBe(true);

      const img = new Image();
      img.src = href;
      await img.decode();
      expect([img.naturalWidth, img.naturalHeight]).toEqual([3, 2]);
      const check = new OffscreenCanvas(3, 2).getContext('2d')!;
      check.drawImage(img, 0, 0);
      expect([...check.getImageData(1, 1, 1, 1).data]).toEqual([255, 0, 0, 255]);
    } finally {
      releaseImage(src);
      bitmap.close();
    }
  });
});
