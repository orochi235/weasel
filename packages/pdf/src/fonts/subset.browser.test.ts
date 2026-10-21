/**
 * A subset face read back by pdf.js draws the same pixels as the whole face.
 */
import { loadFontOutlines, registerFontOutlines, unregisterFontOutlines } from '@weasel-js/font';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import ttfUrl from '../../../../assets/fonts/inter/inter.ttf?url';
import { writePdf } from '../writePdf';
import { registryFontSource } from './fontSource';

GlobalWorkerOptions.workerSrc = workerUrl;
// With the worker module on the main thread, its warnings reach the console spy below.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker;

const FAMILY = 'pdf-subset-browser';
const TEXT = 'Quarterly revenue: Zürich, Malmö';

beforeAll(async () => {
  registerFontOutlines(FAMILY, {}, ttfUrl);
  await loadFontOutlines(FAMILY, {});
});
afterAll(() => unregisterFontOutlines(FAMILY, {}));

const noise: string[] = [];
const PDFJS_LINE = /^(Warning|Error|Info):/;
const spies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((level) =>
  vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
    const line = args.map(String).join(' ');
    // pdf.js announces the main-thread worker this file sets up on purpose.
    if (/fake worker/.test(line)) return;
    if (level === 'warn' || level === 'error' || PDFJS_LINE.test(line)) noise.push(`${level}: ${line}`);
  }));
afterAll(() => spies.forEach((s) => s.mockRestore()));

const line: TextDrawCommand = {
  kind: 'text', x: 10, y: 10, style: { fontFamily: FAMILY, fontSize: 24 },
  runs: [{
    text: TEXT, fontFamily: FAMILY, fontSize: 24, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { color: '#000000' } }, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
  }],
};

async function drawn(subsetFonts: boolean): Promise<{ pixels: Uint8ClampedArray; text: string; bytes: number }> {
  const { bytes, skipped } = await writePdf([{ width: 420, height: 60, commands: [line] }], { fonts: registryFontSource, subsetFonts });
  expect(skipped).toEqual([]);
  const doc = await getDocument({ data: bytes.slice(), verbosity: 5 }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const canvasContext = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext, viewport, background: '#ffffff' }).promise;
  const text = (await page.getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join('');
  return { pixels: canvasContext.getImageData(0, 0, canvas.width, canvas.height).data, text, bytes: bytes.byteLength };
}

describe('a subset face in pdf.js', () => {
  it('draws the same pixels and extracts the same text as the whole face, without a warning', async () => {
    const whole = await drawn(false);
    const subset = await drawn(true);
    expect(subset.bytes).toBeLessThan(whole.bytes / 2);
    expect(whole.text).toBe(TEXT);
    expect(subset.text).toBe(TEXT);
    let inked = 0;
    let worst = 0;
    for (let i = 0; i < whole.pixels.length; i += 4) {
      if (whole.pixels[i]! < 128) inked++;
      for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(whole.pixels[i + c]! - subset.pixels[i + c]!));
    }
    expect(inked).toBeGreaterThan(1000);
    expect(worst).toBeLessThanOrEqual(2);
    expect(noise).toEqual([]);
  });
});
