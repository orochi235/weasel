import { describe, expect, it, vi } from 'vitest';
import { NoGrantedDeviceError, Printers, type BrotherPrinter, type PrinterStatus, type Raster1bpp } from 'obwat';
import { labelRaster, printLabel, sliceAtCuts } from './print';
import { labelGrid, labelRenderPlan, printableBand } from './render';
import { tapeForWidthMm, tapeNamed, TAPES } from './tape';

const raster = (lines: number): Raster1bpp => ({
  lineBytes: 16,
  lineCount: lines,
  rows: Array.from({ length: lines }, (_, i) => new Uint8Array(16).fill(i)),
});

describe('tapes', () => {
  it('carries each width in millimeters from its name', () => {
    expect(tapeNamed('3.5mm')?.widthMm).toBe(3.5);
    expect(tapeForWidthMm(12)).toEqual({ name: '12mm', widthMm: 12, widthPt: 33.6, format: 259 });
    expect(TAPES.map((t) => t.widthMm)).toEqual([3.5, 6, 9, 12, 18, 24, 36]);
  });
});

describe('labelRenderPlan', () => {
  const tape = tapeForWidthMm(12)!;
  const media = Printers.ptP710bt.media(12);

  it('renders the centered printable band at one pixel per dot', () => {
    const band = printableBand(tape, media);
    expect(band.height * (media.dpi / 72)).toBeCloseTo(media.printableDots, 9);
    expect(band.y * 2 + band.height).toBeCloseTo(tape.widthPt, 9);
    const plan = labelRenderPlan({ length: 144, tape, media, origin: { x: 10, y: 20 } });
    expect(plan.sourceRect).toEqual({ x: 10, y: 20 + band.y, width: 144, height: band.height });
    expect(plan.scale).toEqual({ x: 2.5, y: 2.5 });
  });
});

describe('labelGrid', () => {
  it('puts dot (0, 0) at the top of the printable band, one dot per 72/dpi points', () => {
    const tape = tapeForWidthMm(12)!;
    const media = Printers.ptP710bt.media(12);
    expect(labelGrid({ tape, media, origin: { x: 5, y: 7 } })).toEqual({ pitch: 0.4, origin: { x: 5, y: 7 + printableBand(tape, media).y } });
  });
});

describe('labelRaster', () => {
  const media = Printers.ptP710bt.media(12);
  const gray = (v: number) => {
    const data = new Uint8ClampedArray(8 * media.printableDots * 4);
    for (let i = 0; i < data.length; i += 4) data.set([v, v, v, 255], i);
    return { width: 8, height: media.printableDots, data };
  };
  const dots = (r: Raster1bpp) => r.rows.reduce((n, row) => n + row.reduce((m, b) => m + b.toString(2).split('1').length - 1, 0), 0);

  it('lays a dot for every inked pixel and none for paper', () => {
    expect(dots(labelRaster(gray(0), media))).toBe(8 * media.printableDots);
    expect(dots(labelRaster(gray(255), media))).toBe(0);
  });

  it('dithers mid gray with the method asked for', () => {
    const all = 8 * media.printableDots;
    expect(dots(labelRaster(gray(140), media))).toBe(0);
    const bayer = dots(labelRaster(gray(140), media, { method: 'bayer' }));
    expect(bayer).toBeGreaterThan(all * 0.3);
    expect(bayer).toBeLessThan(all * 0.6);
  });
});

describe('sliceAtCuts', () => {
  it('splits at each mark, in dots, dropping the ends and duplicates', () => {
    const pages = sliceAtCuts(raster(100), [28.8, 0, 28.8, 14.4, 40], 180);
    expect(pages.map((p) => p.lineCount)).toEqual([36, 36, 28]);
    expect(pages[1]!.rows[0]![0]).toBe(36);
  });

  it('keeps one page with no marks', () => {
    expect(sliceAtCuts(raster(10), [], 180)).toHaveLength(1);
  });
});

describe('printLabel', () => {
  const media = Printers.ptP710bt.media(12);
  const image = { width: 4, height: media.printableDots, data: new Uint8ClampedArray(4 * media.printableDots * 4).fill(255) };
  const status = { hasError: false } as PrinterStatus;

  function fakePrinter(granted: boolean) {
    let grant = granted;
    return {
      print: vi.fn(async () => {
        if (!grant) throw new NoGrantedDeviceError();
        return status;
      }),
      requestDevice: vi.fn(async () => {
        grant = true;
        return true;
      }),
    } as unknown as BrotherPrinter & { print: ReturnType<typeof vi.fn>; requestDevice: ReturnType<typeof vi.fn> };
  }

  it('sends the pages with the tape the media names', async () => {
    const printer = fakePrinter(true);
    await expect(printLabel({ printer, image, media, cuts: [0.8] })).resolves.toBe(status);
    const [pages, job] = printer.print.mock.calls[0]!;
    expect(pages.map((p: Raster1bpp) => p.lineCount)).toEqual([2, 2]);
    expect(job).toEqual({ tapeWidthMm: 12, autoCut: true, marginDots: 0 });
  });

  it('rejects with no granted device unless asked to show the picker', async () => {
    await expect(printLabel({ printer: fakePrinter(false), image, media })).rejects.toBeInstanceOf(NoGrantedDeviceError);
    const printer = fakePrinter(false);
    await expect(printLabel({ printer, image, media, requestDevice: true })).resolves.toBe(status);
    expect(printer.requestDevice).toHaveBeenCalledOnce();
  });
});
