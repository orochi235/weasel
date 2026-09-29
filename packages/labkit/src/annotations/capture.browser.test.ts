/**
 * A raster capture against real WebGL2 and the real Inter files, with the
 * default family registered lazily the way an app registers it: a text mark
 * captured before anything has drawn text still carries its glyphs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { createAnnotationStore } from './store';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';

/** Pixels where the mark's red ink landed on the transparent export. */
async function inkPixels(blob: Blob): Promise<number> {
  const bitmap = await createImageBitmap(blob);
  const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 128 && data[i] > 150 && data[i + 1] < 120) n++;
  }
  return n;
}

beforeEach(() => _resetFontRegistryForTests());
afterEach(() => _resetFontRegistryForTests());

describe('a raster capture of a text mark', () => {
  it('draws its glyphs when the font was registered lazily and never fetched', async () => {
    void registerFont('sans-serif', {}, metricsUrl, atlasUrl, { lazy: true });
    const store = createAnnotationStore({
      targets: () => [{ id: 'bare', content: { w: 120, h: 40 } }],
    });
    store.add({ target: 'bare', kind: 'text', title: 'Hello', frac: { x: 0.1, y: 0.2, w: 0.5, h: 0.5 } });

    const result = await store.capture('bare', { format: 'png', scale: 2 });

    expect(await inkPixels(result.blob)).toBeGreaterThan(40);
  });
});
