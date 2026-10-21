import { expect, test } from 'vitest';
import { paintDifference } from './difference';
import type { LensCapture } from './lensSource';

// What `paintDifference` puts on a canvas — the crop about the reticle, the
// nearest-neighbor enlargement, and the lit and dimmed pixels — is only
// readable in a browser, which has real bitmaps and a real 2D context.

/** A 2×2 capture of opaque gray, its bottom-right pixel `last`, aimed at its center. */
async function capture(last: readonly [number, number, number]): Promise<LensCapture> {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 2;
  const ctx = c.getContext('2d')!;
  const data = new Uint8ClampedArray(16);
  for (let i = 0; i < 4; i += 1) data.set([100, 100, 100, 255], i * 4);
  data.set([...last, 255], 12);
  ctx.putImageData(new ImageData(data, 2, 2), 0, 0);
  return { bitmap: await createImageBitmap(c), dpr: 1, box: { width: 2, height: 2 }, at: { x: 1, y: 1 } };
}

test('lights the pixel that differs and dims the rest, enlarged about the reticle', async () => {
  const base = await capture([100, 100, 100]);
  const compared = await capture([200, 100, 100]);
  const canvas = document.createElement('canvas');
  const changed = paintDifference(canvas, base, compared, { size: { width: 40, height: 40 }, factor: 10 });
  expect(changed).toBe(1);
  const ctx = canvas.getContext('2d')!;
  const sd = canvas.width / 40;
  // The reticle, at the capture's center, lands on the canvas's center; each
  // capture pixel is 10 CSS px wide either side of it.
  const at = (x: number, y: number) => [...ctx.getImageData(Math.round(x * sd), Math.round(y * sd), 1, 1).data];
  expect(at(25, 25)).toEqual([255, 0, 255, 255]);
  const dimmed = at(15, 15);
  // The canvas keeps colors premultiplied, so a translucent one comes back within a step or two.
  for (const channel of dimmed.slice(0, 3)) expect(Math.abs(channel - 100)).toBeLessThanOrEqual(2);
  expect(dimmed[3]).toBe(64);
  // Outside the capture, nothing is drawn.
  expect(at(2, 2)[3]).toBe(0);
});
