import { type GlMat3, mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { ContentStream } from './content';
import { deflate as zlibDeflate } from './deflate';
import { type PageCtx, pageFlip, writeCommands } from './drawCommands';
import { DocumentFonts } from './fonts/embedFont';
import type { PdfFontSource } from './fonts/fontSource';
import { type Deflater, name, PdfObjects, type PdfRef, text } from './objects';
import { PageResources } from './resources';

/** An axis-aligned rectangle in page units. */
export type Rect = { x: number; y: number; width: number; height: number };

/** One page of the document: its size in points and the draw commands painted onto it. */
export interface PdfPage {
  width: number;
  height: number;
  commands: readonly DrawCommand[];
  view?: GlMat3;
}

/** A decoded bitmap handed back by the host, for images and paints the PDF cannot express directly. */
export interface RasterPixels {
  width: number;
  height: number;
  /** Straight RGBA, top-down. */
  data: Uint8ClampedArray;
}

/** Settings and host callbacks for `writePdf`; only `fonts` is required. */
export interface WritePdfOptions {
  fonts: PdfFontSource;
  title?: string;
  /** Default true; unit tests pass false because jsdom realms lack `CompressionStream`. */
  compress?: boolean;
  readPixels?: (image: ImageBitmap | HTMLImageElement) => RasterPixels;
  /**
   * Draws `commands`, which are in the page's frame, in order onto a clear raster of `rect` at `scale`
   * pixels per point. `view` is the page's `PdfPage.view`: what a `world`-unit paint in `commands`
   * resolves through. For a group with its own `composite`, `commands` are the page up to and including
   * that group, so the raster is the group composited onto what it was drawn over.
   */
  rasterize?: (commands: readonly DrawCommand[], rect: Rect, scale: number, view: GlMat3 | undefined) => Promise<RasterPixels>;
}

/** A glyph or command the writer left out of the file, with the reason. */
export interface PdfSkip {
  kind: 'glyph' | 'command';
  detail: string;
}

/** The finished file and everything the writer had to leave out of it. */
export interface PdfResult {
  bytes: Uint8Array;
  skipped: readonly PdfSkip[];
}

/** One PDF page per entry of `pages`, which must hold at least one. */
export function writePdf(pages: readonly PdfPage[], opts: WritePdfOptions): Promise<PdfResult> {
  return writePdfWith(pages, opts, zlibDeflate);
}

/** `writePdf` with its compressor supplied; tests use it where `CompressionStream` is missing. Not re-exported by the package. */
export async function writePdfWith(
  pages: readonly PdfPage[],
  opts: WritePdfOptions,
  deflate: Deflater,
): Promise<PdfResult> {
  if (pages.length === 0) throw new Error('pdf: a document needs at least one page');
  const objects = new PdfObjects();
  const catalog = objects.alloc();
  const tree = objects.alloc();
  const info = objects.alloc();
  const skipped: PdfSkip[] = [];
  const kids: PdfRef[] = [];
  const fonts = new DocumentFonts(objects, opts.fonts);

  for (const page of pages) {
    const pageRef = objects.alloc();
    const contentRef = objects.alloc();
    const ctx: PageCtx = {
      objects,
      resources: new PageResources(),
      out: new ContentStream(),
      opts,
      fonts,
      skipped,
      view: page.view,
      width: page.width,
      height: page.height,
      trail: [],
    };
    // Page units are points, origin top left, y down.
    ctx.out.op('cm', ...mat3.toAffine(pageFlip(page)));
    await writeCommands(ctx, page.commands, { transform: mat3.identity(), alpha: 1, colorMatrix: null });
    const raw = ctx.out.bytes();
    objects.streamDeflated(contentRef, {}, raw);
    objects.set(pageRef, {
      Type: name('Page'),
      Parent: tree,
      MediaBox: [0, 0, page.width, page.height],
      Contents: contentRef,
      Resources: ctx.resources.dict(),
    });
    kids.push(pageRef);
  }

  objects.set(catalog, { Type: name('Catalog'), Pages: tree });
  objects.set(tree, { Type: name('Pages'), Kids: kids, Count: kids.length });
  objects.set(info, { Producer: text('weasel'), Title: opts.title === undefined ? undefined : text(opts.title) });
  await fonts.finish();
  await objects.settle(opts.compress !== false, deflate);
  return { bytes: objects.serialize(catalog, info), skipped };
}
