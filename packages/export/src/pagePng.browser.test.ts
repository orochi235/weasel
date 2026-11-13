/**
 * A page of a plain scene exported as PNG against real WebGL2, decoded back to pixels.
 */
import { describe, expect, it } from 'vitest';
import { exportPagePng } from '@weasel-js/export';
import { plainScene } from '@weasel-js/export/testing/plainScene';

async function pixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

const rgba = (img: ImageData, x: number, y: number): number[] =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('exportPagePng', () => {
  it('is a PNG the size of the page times the scale', async () => {
    const { scene, pages } = plainScene();
    const blob = await exportPagePng(scene, pages[0]!, { scale: 2 });
    expect(blob.type).toBe('image/png');
    const img = await pixels(blob);
    expect([img.width, img.height]).toEqual([400, 200]);
  });

  it('draws the kit shapes on the page, over no background unless given one', async () => {
    const { scene, pages } = plainScene();
    const img = await pixels(await exportPagePng(scene, pages[0]!, { scale: 1 }));
    expect(rgba(img, 2, 2)[3]).toBe(0);
    // The red rect spans (20, 20) to (80, 60), the green ellipse (100, 30) to (140, 60).
    expect(rgba(img, 50, 40)).toEqual([255, 0, 0, 255]);
    expect(rgba(img, 120, 45)).toEqual([0, 255, 0, 255]);
    const painted = await pixels(await exportPagePng(scene, pages[0]!, { scale: 1, background: '#fafafa' }));
    expect(rgba(painted, 2, 2)).toEqual([250, 250, 250, 255]);
  });

  it('leaves out annotation layers', async () => {
    const { scene, pages } = plainScene();
    const img = await pixels(await exportPagePng(scene, pages[0]!, { scale: 1, background: '#ffffff' }));
    // The gray note spans (150, 70) to (170, 90).
    expect(rgba(img, 160, 80)).toEqual([255, 255, 255, 255]);
  });
});
