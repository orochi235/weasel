/**
 * A plain scene exported as PDF, read back and drawn by pdf.js.
 */
import { describe, expect, it } from 'vitest';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { plainScene } from '@weasel-js/core/testing/plainScene';
import { parallaxScene } from '@weasel-js/core/testing/parallaxScene';
import { __setImageLoaderForTests, _resetImageCacheForTests } from '@weasel-js/renderer/test-seams';
import { exportRegionsPdf } from './regionsPdf';

GlobalWorkerOptions.workerSrc = workerUrl;
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker;

async function read(blob: Blob): Promise<PDFDocumentProxy> {
  return getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 }).promise;
}

async function draw(doc: PDFDocumentProxy, n: number): Promise<ImageData> {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const canvasContext = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext, viewport, background: '#ffffff' }).promise;
  return canvasContext.getImageData(0, 0, canvas.width, canvas.height);
}

const rgb = (img: ImageData, x: number, y: number): number[] => {
  const at = (y * img.width + x) * 4;
  return [img.data[at]!, img.data[at + 1]!, img.data[at + 2]!];
};

describe('exportRegionsPdf', () => {
  it('writes one page per page, each at the page size in points, skipping nothing', async () => {
    const { scene, pages } = plainScene();
    const { blob, skipped } = await exportRegionsPdf(scene, pages);
    expect(skipped).toEqual([]);
    const doc = await read(blob);
    expect(doc.numPages).toBe(2);
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
    expect([vp.width, vp.height]).toEqual([150, 75]);
  });

  it('draws each page its own shapes, with annotation layers left out', async () => {
    const { scene, pages } = plainScene();
    const doc = await read((await exportRegionsPdf(scene, pages)).blob);
    const first = await draw(doc, 1);
    // 0.75 points to the unit: the red rect's center (50, 40) is at (37, 30), the gray note's (160, 80) at (120, 60).
    expect(rgb(first, 37, 30)).toEqual([255, 0, 0]);
    expect(rgb(first, 120, 60)).toEqual([255, 255, 255]);
    // The blue path spans (300, 30) to (340, 60) in the world, 60 into page 2.
    expect(rgb(await draw(doc, 2), 60, 33)).toEqual([0, 0, 255]);
  });

  it('labels each page with its region name', async () => {
    const { scene, pages } = plainScene();
    const regions = [{ ...pages[0]!, name: 'Front' }, { x: 0, y: 0, width: 440, height: 100, name: 'Spread' }];
    const doc = await read((await exportRegionsPdf(scene, regions)).blob);
    expect(await doc.getPageLabels()).toEqual(['Front', 'Spread']);
    const vp = (await doc.getPage(2)).getViewport({ scale: 1 });
    expect([vp.width, vp.height]).toEqual([330, 75]);
  });

  it('draws a parallax plane node over the whole of its own region', async () => {
    const scene = parallaxScene({ pan: 0.5, zoom: 0.5, anchor: { x: 37, y: -12 } });
    scene.setHidden('b' as never, true);
    const region = { x: 90, y: -10, width: 30, height: 30 };
    const page = await draw(await read((await exportRegionsPdf(scene, [region])).blob), 1);
    // The node spans (100, 0) to (110, 10): 7.5 to 15 points into the page on both axes.
    expect(rgb(page, 11, 11)).toEqual([255, 0, 0]);
    expect(rgb(page, 4, 4)).toEqual([255, 255, 255]);
    expect(rgb(page, 18, 18)).toEqual([255, 255, 255]);
  });

  it('writes every page from the revision an edit made while a later page loaded its picture', async () => {
    _resetImageCacheForTests();
    let release = () => {};
    const held = new Promise<void>((r) => { release = r; });
    __setImageLoaderForTests(async () => {
      await held;
      return createImageBitmap(new ImageData(new Uint8ClampedArray([0, 0, 255, 255]), 1, 1));
    });
    try {
      const { scene, pages } = plainScene();
      scene.add({ id: 'i', kind: 'mark', layer: 'main', parent: null, pose: { x: 400, y: 70, width: 20, height: 20 }, data: { image: { src: 'held' } } } as never);
      const pdf = exportRegionsPdf(scene, pages);
      await new Promise((r) => setTimeout(r, 0));
      const green = { shape: 'rect', fill: { paint: { kind: 'solid', color: '#00ff00' } } };
      scene.update('r' as never, { data: green });
      scene.update('p' as never, { data: { path: { kind: 'rect', x: 300, y: 30, width: 40, height: 30 }, fill: green.fill } });
      release();
      const doc = await read((await pdf).blob);
      expect(rgb(await draw(doc, 1), 37, 30)).toEqual([0, 255, 0]);
      expect(rgb(await draw(doc, 2), 60, 33)).toEqual([0, 255, 0]);
    } finally {
      _resetImageCacheForTests();
    }
  });
});
