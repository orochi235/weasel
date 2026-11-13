/**
 * A plain scene exported as PDF, read back and drawn by pdf.js.
 */
import { describe, expect, it } from 'vitest';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { plainScene } from '@weasel-js/core/testing/plainScene';
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
});
