import { type GlMat3, mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { ContentStream } from './content';
import { deflate as zlibDeflate } from './deflate';
import { type PageCtx, writeCommands } from './drawCommands';
import type { PdfFontSource } from './fonts/fontSource';
import { type Deflater, name, PdfObjects, type PdfRef, text } from './objects';
import { PageResources } from './resources';

type Rect = { x: number; y: number; width: number; height: number };

export interface PdfPage {
  width: number;
  height: number;
  commands: readonly DrawCommand[];
  view?: GlMat3;
}

export interface RasterPixels {
  width: number;
  height: number;
  /** Straight RGBA, top-down. */
  data: Uint8ClampedArray;
}

export interface WritePdfOptions {
  fonts: PdfFontSource;
  title?: string;
  /** Default true; unit tests pass false because jsdom realms lack `CompressionStream`. */
  compress?: boolean;
  readPixels?: (image: ImageBitmap | HTMLImageElement) => RasterPixels;
  rasterize?: (commands: readonly DrawCommand[], rect: Rect, scale: number) => Promise<RasterPixels>;
}

export interface PdfSkip {
  kind: 'glyph' | 'command';
  detail: string;
}

export interface PdfResult {
  bytes: Uint8Array;
  skipped: readonly PdfSkip[];
}

export function writePdf(pages: readonly PdfPage[], opts: WritePdfOptions): Promise<PdfResult> {
  return writePdfWith(pages, opts, zlibDeflate);
}

/** `writePdf` with its compressor supplied; tests use it where `CompressionStream` is missing. Not re-exported by the package. */
export async function writePdfWith(
  pages: readonly PdfPage[],
  opts: WritePdfOptions,
  deflate: Deflater,
): Promise<PdfResult> {
  const objects = new PdfObjects();
  const catalog = objects.alloc();
  const tree = objects.alloc();
  const info = objects.alloc();
  const skipped: PdfSkip[] = [];
  const kids: PdfRef[] = [];

  for (const page of pages) {
    const pageRef = objects.alloc();
    const contentRef = objects.alloc();
    const ctx: PageCtx = {
      objects,
      resources: new PageResources(),
      out: new ContentStream(),
      opts,
      skipped,
      view: page.view,
      height: page.height,
    };
    // Page units are points, origin top left, y down.
    ctx.out.op('cm', 1, 0, 0, -1, 0, page.height);
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
  await objects.settle(opts.compress !== false, deflate);
  return { bytes: objects.serialize(catalog, info), skipped };
}
