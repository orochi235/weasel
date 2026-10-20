/**
 * A diagram exported as PDF, read back and drawn by pdf.js.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { registerFont, registerFontOutlines } from '@weasel-js/font';
import { registerDiagramShape } from '@weasel-js/diagram';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import metricsUrl from '../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../assets/fonts/inter/inter.ttf?url';
import { exportPagesPdf } from './pagesPdf';
import { pageScene } from './testing/pageScene';

GlobalWorkerOptions.workerSrc = workerUrl;
// With the worker module on the main thread, its warnings reach the console spy below.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker;

const GRADIENT_BOX = {
  id: 'g' as never, kind: 'leaf' as const, layer: 'main' as const,
  pose: { x: 150, y: 10, width: 40, height: 30 },
  data: {
    diagram: { outline: 'rect' },
    fill: {
      paint: {
        kind: 'linear-gradient', units: 'bounds', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
        stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: 'rgba(255,0,0,0)' }],
      },
    },
  },
};

let disposeShape: () => void;
beforeAll(async () => {
  disposeShape = registerDiagramShape();
  await registerFont('sans-serif', { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
  registerFontOutlines('sans-serif', { weight: 400, style: 'normal' }, ttfUrl);
});
afterAll(() => disposeShape());

const noise: string[] = [];
const spies = (['log', 'warn', 'error'] as const).map((level) =>
  vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
    const line = args.map(String).join(' ');
    if (level !== 'log' || /^(Warning|Error):/.test(line)) noise.push(`${level}: ${line}`);
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

  it('draws every page in pdf.js without a warning, and a fading gradient part-way clear', async () => {
    const { scene, pages } = pageScene();
    scene.add(GRADIENT_BOX as never);
    const doc = await read((await exportPagesPdf(scene, pages, { background: '#ffffff' })).blob);
    const first = await draw(doc, 1, 2);
    await draw(doc, 2, 2);
    // The box spans (150, 10) to (190, 40); at 0.75 pt per unit and scale 2 its middle is (255, 37.5).
    const at = (37 * first.width + 255) * 4;
    const [r, g, b] = [first.data[at]!, first.data[at + 1]!, first.data[at + 2]!];
    expect(r).toBeGreaterThan(200);
    // Opaque red leaves green at 0 and a clear box leaves the white page's 255.
    expect(g).toBeGreaterThan(40);
    expect(g).toBeLessThan(215);
    expect(Math.abs(b - g)).toBeLessThanOrEqual(3);
    expect(noise).toEqual([]);
  });
});
