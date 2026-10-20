/**
 * A page exported as PNG against real WebGL2, decoded back to pixels.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerDiagramShape } from '@weasel-js/diagram';
import { exportPagePng } from './pagePng';
import { pageScene } from './testing/pageScene';

async function pixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

const rgb = (img: ImageData, x: number, y: number): number[] =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

let dispose: () => void;
beforeAll(() => { dispose = registerDiagramShape(); });
afterAll(() => dispose());

describe('exportPagePng', () => {
  it('is a PNG the size of the page times the scale', async () => {
    const { scene, pages } = pageScene();
    const blob = await exportPagePng(scene, pages[0]!, { scale: 2, background: '#fafafa' });
    expect(blob.type).toBe('image/png');
    const img = await pixels(blob);
    expect([img.width, img.height]).toEqual([400, 200]);
  });

  it('paints the page color at a corner and a shape fill at its center', async () => {
    const { scene, pages } = pageScene();
    const img = await pixels(await exportPagePng(scene, pages[0]!, { scale: 2, background: '#fafafa' }));
    expect(rgb(img, 2, 2)).toEqual([250, 250, 250]);
    // The green box spans (100, 65) to (140, 95); its center is (120, 80), at 2x.
    expect(rgb(img, 240, 160)).toEqual([0, 255, 0]);
  });

  it('draws the page it is given, from its own corner', async () => {
    const { scene, pages } = pageScene();
    const img = await pixels(await exportPagePng(scene, pages[1]!, { scale: 1, background: '#fafafa' }));
    // The blue box spans (301, 30) to (341, 60) in the world, 240 into page 2.
    expect(rgb(img, 81, 45)).toEqual([0, 0, 255]);
    expect(rgb(img, 150, 45)).toEqual([250, 250, 250]);
  });
});
