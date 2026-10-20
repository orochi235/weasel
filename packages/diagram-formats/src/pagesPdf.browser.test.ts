/**
 * A diagram exported as PDF, read back and drawn by pdf.js.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRasterSession, viewToMat3 } from '@weasel-js/core';
import { registerFont, registerFontOutlines } from '@weasel-js/font';
import { registerDiagramShape } from '@weasel-js/diagram';
import { writePdf } from '@weasel-js/pdf';
import { blur, type DrawCommand } from '@weasel-js/renderer';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import metricsUrl from '../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../assets/fonts/inter/inter.ttf?url';
import { exportPagesPdf } from './pagesPdf';
import { pageRasterizer } from './pdfRaster';
import { pageScene } from './testing/pageScene';

GlobalWorkerOptions.workerSrc = workerUrl;
// With the worker module on the main thread, its warnings reach the console spy below.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker;

const STOPS = [{ offset: 0, color: '#ff0000' }, { offset: 1, color: 'rgba(255,0,0,0)' }];

/** A box (150, y) to (190, y + 30) filled red to clear along x, in the given units. */
const gradientBox = (id: string, y: number, units: 'bounds' | 'world') => ({
  id: id as never, kind: 'leaf' as const, layer: 'main' as const,
  pose: { x: 150, y, width: 40, height: 30 },
  data: {
    diagram: { outline: 'rect' },
    fill: {
      paint: {
        kind: 'linear-gradient', units, stops: STOPS,
        ...(units === 'bounds'
          ? { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }
          : { from: { x: 150, y: 0 }, to: { x: 190, y: 0 } }),
      },
    },
  },
});

let disposeShape: () => void;
beforeAll(async () => {
  disposeShape = registerDiagramShape();
  await registerFont('sans-serif', { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
  registerFontOutlines('sans-serif', { weight: 400, style: 'normal' }, ttfUrl);
});
afterAll(() => disposeShape());

const noise: string[] = [];
const PDFJS_LINE = /^(Warning|Error|Info):/;
const spies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((level) =>
  vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
    const line = args.map(String).join(' ');
    if (level === 'warn' || level === 'error' || PDFJS_LINE.test(line)) noise.push(`${level}: ${line}`);
  }));
afterEach(() => { noise.length = 0; });
afterAll(() => spies.forEach((s) => s.mockRestore()));

async function read(blob: Blob): Promise<PDFDocumentProxy> {
  return getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 5 }).promise;
}

async function draw(doc: PDFDocumentProxy, n: number, scale: number): Promise<ImageData> {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale });
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

describe('exportPagesPdf', () => {
  it('writes one page per page, each at the page size in points', async () => {
    const { scene, pages } = pageScene();
    const doc = await read((await exportPagesPdf(scene, pages)).blob);
    expect(doc.numPages).toBe(2);
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
    expect([vp.width, vp.height]).toEqual([150, 75]);
  });

  it('holds the text row as text a reader can extract', async () => {
    const { scene, pages } = pageScene();
    const page = await (await read((await exportPagesPdf(scene, pages)).blob)).getPage(1);
    const items = (await page.getTextContent()).items;
    expect(items.map((i) => ('str' in i ? i.str : '')).join('')).toContain('Start');
  });

  it('keeps the space inside a two-word label', async () => {
    const { scene, pages } = pageScene();
    scene.update('a/row' as never, {
      data: { text: 'Start here', style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: { paint: { color: '#000000' } } },
    } as never);
    const page = await (await read((await exportPagesPdf(scene, pages)).blob)).getPage(1);
    const items = (await page.getTextContent()).items;
    expect(items.map((i) => ('str' in i ? i.str : '')).join('')).toContain('Start here');
  });

  it('skips nothing on a plain diagram page', async () => {
    const { scene, pages } = pageScene();
    expect((await exportPagesPdf(scene, pages)).skipped).toEqual([]);
  });

  it('paints the page color to the edge of a page whose size is not a whole number of points', async () => {
    const { scene } = pageScene();
    // 203 × 101 units is 152.25 × 75.75 points; at scale 4 the last column and row are partly page.
    const doc = await read((await exportPagesPdf(scene, [{ x: 0, y: 0, width: 203, height: 101 }], { background: '#000000' })).blob);
    const img = await draw(doc, 1, 4);
    expect([img.width, img.height]).toEqual([609, 303]);
    expect(rgb(img, 608, 150)[0]).toBeLessThan(80);
    expect(rgb(img, 300, 302)[0]).toBeLessThan(80);
  });

  it('draws every page in pdf.js without a warning, and gradients fade part-way clear in the right direction', async () => {
    const { scene, pages } = pageScene();
    scene.add(gradientBox('g', 10, 'bounds') as never);
    scene.add(gradientBox('w', 50, 'world') as never);
    const doc = await read((await exportPagesPdf(scene, pages, { background: '#ffffff' })).blob);
    const first = await draw(doc, 1, 2);
    await draw(doc, 2, 2);
    // Each box spans x 150 to 190: 0.75 pt per unit and scale 2 put 25% at pixel 240 and 50% at 255.
    for (const y of [37, 105]) {
      const [r, g25] = rgb(first, 240, y);
      const [, g50, b50] = rgb(first, 255, y);
      expect(r).toBeGreaterThan(200);
      // Opaque red leaves green at 0 and a clear box leaves the white page's 255.
      expect(g25).toBeGreaterThan(20);
      expect(g25).toBeLessThan(110);
      expect(g50).toBeGreaterThan(80);
      expect(g50).toBeLessThan(180);
      expect(Math.abs(b50 - g50)).toBeLessThanOrEqual(3);
    }
    expect(noise).toEqual([]);
  });
});

describe('the raster hook', () => {
  it('draws a world-unit gradient where the vector path puts it', async () => {
    const view = { x: 0, y: 0, scale: { x: 0.75, y: 0.75 } };
    const ground: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 150, height: 75 }, fill: { paint: { color: '#ffffff' } } };
    const ramp: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: 112.5, y: 7.5, width: 30, height: 22.5 },
      fill: { paint: { kind: 'linear-gradient', units: 'world', from: { x: 150, y: 0 }, to: { x: 190, y: 0 }, stops: STOPS } },
    };
    const page = (effects: boolean) => ({
      width: 150, height: 75, view: viewToMat3(view),
      commands: [ground, { kind: 'group' as const, ...(effects ? { effects: blur({ radius: 0 }) } : {}), children: [ramp] }],
    });
    const session = createRasterSession();
    try {
      const rasterize = pageRasterizer(session);
      const drawn = async (effects: boolean) => {
        const { bytes, skipped } = await writePdf([page(effects)], { fonts: { embedding: async () => null, outline: () => null }, rasterize });
        expect(skipped).toEqual([]);
        return draw(await read(new Blob([bytes.slice().buffer as ArrayBuffer])), 1, 2);
      };
      const vector = await drawn(false);
      const raster = await drawn(true);
      for (const x of [240, 255]) {
        const want = rgb(vector, x, 38)[1]!;
        expect(want).toBeGreaterThan(20);
        expect(want).toBeLessThan(215);
        expect(Math.abs(rgb(raster, x, 38)[1]! - want)).toBeLessThanOrEqual(25);
      }
    } finally {
      session.dispose();
    }
  });
});
