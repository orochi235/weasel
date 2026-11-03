import { describe, expect, it, vi } from 'vitest';
import { NoGrantedDeviceError, Printers, type BrotherPrinter, type PrinterStatus, type Raster1bpp } from 'obwat';
import { printLabel, sliceAtCuts } from './print';
import { labelRenderPlan, printableBand } from './render';
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
