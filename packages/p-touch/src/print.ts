/**
 * A rendered label to paper: dots, pages at the cut marks, and the job sent through obwat.
 */
import {
  NoGrantedDeviceError,
  rgbaToRaster,
  type BrotherPrinter,
  type DitherOptions,
  type MediaSpec,
  type PrinterStatus,
  type Raster1bpp,
  type RgbaImage,
} from 'obwat';

/**
 * Split a raster into pages at `cutsPt`, positions along the label in points from its leading
 * edge. The printer cuts between pages when auto-cut is on. Marks at or past either end, and marks
 * landing on the same dot, are dropped; with none left the raster is one page.
 */
export function sliceAtCuts(raster: Raster1bpp, cutsPt: readonly number[], dpi: number): Raster1bpp[] {
  const cutDots = [...new Set(cutsPt.map((x) => Math.round(x * (dpi / 72))))]
    .filter((d) => d > 0 && d < raster.lineCount)
    .sort((a, b) => a - b);
  const bounds = [0, ...cutDots, raster.lineCount];
  const pages: Raster1bpp[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const rows = raster.rows.slice(bounds[i], bounds[i + 1]);
    pages.push({ lineBytes: raster.lineBytes, lineCount: rows.length, rows });
  }
  return pages;
}

/** What {@link printLabel} sends, and how. */
export interface PrintLabelOptions {
  printer: BrotherPrinter;
  /** The label at one pixel per dot, `media.printableDots` tall: what `renderLabel` returns. */
  image: RgbaImage;
  media: MediaSpec;
  /** Cut after each page and at the end. Default true. */
  autoCut?: boolean;
  /** Where to cut along the label, in points: see {@link sliceAtCuts}. */
  cuts?: readonly number[];
  /** How gray becomes dots. Default obwat's: a plain threshold. */
  dither?: DitherOptions;
  /**
   * When no printer has been granted yet, show the browser's device picker and print to what is
   * chosen, rather than rejecting with obwat's `NoGrantedDeviceError`. Only works inside a user
   * gesture. Default false.
   */
  requestDevice?: boolean;
}

/**
 * Print `image` as one job. Resolves with the printer's status reply, which reports what it found
 * as the job started (a missing tape, an open cover), not that it finished.
 */
export async function printLabel(opts: PrintLabelOptions): Promise<PrinterStatus> {
  const { printer, image, media, autoCut = true, cuts = [], dither, requestDevice = false } = opts;
  const raster = rgbaToRaster(image, media, dither);
  const pages = sliceAtCuts(raster, cuts, media.dpi);
  const job = { tapeWidthMm: media.tapeWidthMm, autoCut, marginDots: 0 };
  try {
    return await printer.print(pages, job);
  } catch (err) {
    if (!requestDevice || !(err instanceof NoGrantedDeviceError)) throw err;
    await printer.requestDevice();
    return await printer.print(pages, job);
  }
}
