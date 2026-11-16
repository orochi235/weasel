/**
 * A region of a plain scene exported as PNG against real WebGL2, decoded back to pixels.
 */
import { describe, expect, it } from 'vitest';
import { plainScene } from './testing/plainScene';
import { PARALLAX_POSE, parallaxScene } from './testing/parallaxScene';
import { exportRegionPng } from './regionPng';

async function pixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

const rgba = (img: ImageData, x: number, y: number): number[] =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('exportRegionPng', () => {
  it('is a PNG the size of the region times the scale', async () => {
    const { scene, pages } = plainScene();
    const blob = await exportRegionPng(scene, pages[0]!, { scale: 2 });
    expect(blob.type).toBe('image/png');
    const img = await pixels(blob);
    expect([img.width, img.height]).toEqual([400, 200]);
  });

  it('draws the kit shapes on the page, over no background unless given one', async () => {
    const { scene, pages } = plainScene();
    const img = await pixels(await exportRegionPng(scene, pages[0]!, { scale: 1 }));
    expect(rgba(img, 2, 2)[3]).toBe(0);
    // The red rect spans (20, 20) to (80, 60), the green ellipse (100, 30) to (140, 60).
    expect(rgba(img, 50, 40)).toEqual([255, 0, 0, 255]);
    expect(rgba(img, 120, 45)).toEqual([0, 255, 0, 255]);
    const painted = await pixels(await exportRegionPng(scene, pages[0]!, { scale: 1, background: '#fafafa' }));
    expect(rgba(painted, 2, 2)).toEqual([250, 250, 250, 255]);
  });

  it('leaves out annotation layers', async () => {
    const { scene, pages } = plainScene();
    const img = await pixels(await exportRegionPng(scene, pages[0]!, { scale: 1, background: '#ffffff' }));
    // The gray note spans (150, 70) to (170, 90).
    expect(rgba(img, 160, 80)).toEqual([255, 255, 255, 255]);
  });

  it('fills a parallax plane node\'s own region with it, at every scale', async () => {
    const scene = parallaxScene({ pan: 0.5, zoom: 0.5, anchor: { x: 37, y: -12 } });
    scene.setHidden('b' as never, true);
    for (const scale of [1, 3]) {
      const img = await pixels(await exportRegionPng(scene, PARALLAX_POSE, { scale }));
      const n = 10 * scale;
      for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1], [n / 2, n / 2]]) {
        expect(rgba(img, x!, y!)).toEqual([255, 0, 0, 255]);
      }
    }
  });
});
