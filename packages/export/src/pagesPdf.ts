/**
 * Every page of a scene as one PDF.
 */
import {
  commandRasterizer, createRasterSession, documentOf, holdImageBitmaps, planPixelRender, viewToMat3, warmRender,
} from '@weasel-js/core';
import { registryFontSource, writePdf, type PdfPage, type PdfSkip } from '@weasel-js/pdf';
import type { PageExportScene, PageRect } from './pageNodes';

/** PDF points per page unit: 72 points to the inch over 96 units to the inch. */
const PT_PER_UNIT = 0.75;

/** Options for {@link exportPagesPdf}. */
export interface ExportPagesPdfOptions {
  /** The color painted under each page. Default none: the page is left unpainted. */
  background?: string | null;
  /** The document's title. */
  title?: string;
  /** The document's language, a BCP 47 tag. Default: the language every text on the pages shares, if they share one. */
  lang?: string;
}

/**
 * Write each of `pages` of `scene` as a page of one PDF, `page × 0.75` points
 * in size, in the order given. Shapes and strokes are vector; text is real,
 * selectable text in its embedded face. What a PDF cannot draw is painted
 * through the renderer and placed as an image, and anything it could not
 * carry at all comes back in `skipped`. Annotation layers are left out.
 *
 * The caller has registered what the scene needs painting with, as for
 * `exportPagePng`, including each font's outlines. Needs WebGL2 and
 * `OffscreenCanvas`.
 */
export async function exportPagesPdf(
  scene: PageExportScene,
  pages: readonly PageRect[],
  opts: ExportPagesPdfOptions = {},
): Promise<{ blob: Blob; skipped: readonly PdfSkip[] }> {
  const background = opts.background ?? null;
  // A page's commands hold bitmaps while the next page's images load.
  const release = holdImageBitmaps();
  try {
    return await writePages(scene, pages, background, opts);
  } finally {
    release();
  }
}

async function writePages(
  scene: PageExportScene, pages: readonly PageRect[], background: string | null, opts: ExportPagesPdfOptions,
): Promise<{ blob: Blob; skipped: readonly PdfSkip[] }> {
  const out: PdfPage[] = [];
  for (const page of pages) {
    const args = {
      // An export draws the document, not what an open gesture or edit is showing.
      scene: documentOf(scene),
      sourceRect: { x: page.x, y: page.y, width: page.width, height: page.height },
      scale: { x: PT_PER_UNIT, y: PT_PER_UNIT },
    };
    await warmRender({ render: args });
    const plan = planPixelRender(args);
    const width = page.width * PT_PER_UNIT;
    const height = page.height * PT_PER_UNIT;
    // The planner sizes a background to whole pixels, which can stop short of the page's edge.
    const ground = background === null ? [] : [{
      kind: 'path' as const,
      path: { kind: 'rect' as const, x: 0, y: 0, width, height },
      fill: { paint: { kind: 'solid' as const, color: background } },
    }];
    out.push({ width, height, commands: [...ground, ...plan.commands], view: viewToMat3(plan.view) });
  }

  const session = createRasterSession();
  try {
    const { bytes, skipped } = await writePdf(out, {
      fonts: registryFontSource,
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.lang !== undefined ? { lang: opts.lang } : {}),
      rasterize: commandRasterizer(session),
    });
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return { blob: new Blob([copy], { type: 'application/pdf' }), skipped };
  } finally {
    session.dispose();
  }
}
