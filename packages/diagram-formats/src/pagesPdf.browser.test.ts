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
  // The view puts world 150..190 on page points 112.5..142.5, which is where a screen-unit ramp is measured.
  it.each([
    ['world', { x: 150, y: 0 }, { x: 190, y: 0 }],
    ['screen', { x: 112.5, y: 0 }, { x: 142.5, y: 0 }],
  ] as const)('draws a %s-unit gradient where the vector path puts it', async (units, from, to) => {
    const view = { x: 0, y: 0, scale: { x: 0.75, y: 0.75 } };
    const ground: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 150, height: 75 }, fill: { paint: { color: '#ffffff' } } };
    const ramp: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: 112.5, y: 7.5, width: 30, height: 22.5 },
      fill: { paint: { kind: 'linear-gradient', units, from, to, stops: STOPS } },
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
  it('blurs the same pixels into a raster cropped to the blur\'s reach as into the whole page', async () => {
    const blob: DrawCommand = {
      kind: 'group', effects: blur({ radius: 6 }),
      children: [{ kind: 'path', path: { kind: 'rect', x: 50, y: 30, width: 20, height: 10 }, fill: { paint: { color: '#ff0000' } } }],
    };
    const session = createRasterSession();
    try {
      const rasterize = pageRasterizer(session);
      const whole = await rasterize([blob], { x: 0, y: 0, width: 150, height: 75 }, 2, undefined);
      // The rect writePdf asks for: 12 raster pixels of reach are 6 points, and a point of slack.
      const crop = { x: 43, y: 23, width: 34, height: 24 };
      const part = await rasterize([blob], crop, 2, undefined);
      expect([part.width, part.height]).toEqual([68, 48]);
      let worst = 0;
      let painted = 0;
      for (let y = 0; y < part.height; y++) {
        for (let x = 0; x < part.width; x++) {
          const a = (y * part.width + x) * 4;
          const b = ((y + crop.y * 2) * whole.width + x + crop.x * 2) * 4;
          if (part.data[a + 3]! > 0) painted++;
          for (let c = 0; c < 4; c++) worst = Math.max(worst, Math.abs(part.data[a + c]! - whole.data[b + c]!));
        }
      }
      expect(painted).toBeGreaterThan(20 * 10 * 4);
      expect(worst).toBeLessThanOrEqual(2);
    } finally {
      session.dispose();
    }
  });
});
