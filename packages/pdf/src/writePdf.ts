import type { GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { deflate } from './deflate';
import type { PdfFontSource } from './fonts/fontSource';
import { num } from './num';
import { name, PdfObjects, type PdfRef, text } from './objects';

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

/** Page units are points, origin top left, y down. */
function pageContent(page: PdfPage): string {
  const head = `1 0 0 -1 0 ${num(page.height)} cm\n`;
  // Task 3 replaces this with writeCommands(ctx, page.commands, state).
  return head;
}

export async function writePdf(pages: readonly PdfPage[], opts: WritePdfOptions): Promise<PdfResult> {
  const objects = new PdfObjects();
  const catalog = objects.alloc();
  const tree = objects.alloc();
  const info = objects.alloc();
  const skipped: PdfSkip[] = [];
  const kids: PdfRef[] = [];

  for (const page of pages) {
    const pageRef = objects.alloc();
    const contentRef = objects.alloc();
    const raw = Uint8Array.from(pageContent(page), (c) => c.charCodeAt(0));
    if (opts.compress === false) objects.stream(contentRef, {}, raw);
    else objects.stream(contentRef, { Filter: name('FlateDecode') }, await deflate(raw));
    objects.set(pageRef, {
      Type: name('Page'),
      Parent: tree,
      MediaBox: [0, 0, page.width, page.height],
      Contents: contentRef,
      Resources: {},
    });
    kids.push(pageRef);
  }

  objects.set(catalog, { Type: name('Catalog'), Pages: tree });
  objects.set(tree, { Type: name('Pages'), Kids: kids, Count: kids.length });
  objects.set(info, { Producer: text('weasel'), Title: opts.title === undefined ? undefined : text(opts.title) });
  return { bytes: objects.serialize(catalog, info), skipped };
}
