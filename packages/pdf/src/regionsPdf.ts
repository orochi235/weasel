/**
 * Regions of a scene as one PDF, a page each, and the `pdf` export format.
 */
import {
  commandRasterizer, createRasterSession, holdImageBitmaps, planPixelRender, regionRenderArgs, registerExportFormat,
  viewToMat3, warmRender, type ExportFormat, type ExportOptions, type ExportRegion, type ExportScene,
} from '@weasel-js/core';
import { registryFontSource } from './fonts/fontSource';
import { writePdf, type PdfPage, type PdfSkip } from './writePdf';

/** PDF points per world unit: 72 points to the inch over 96 units to the inch. */
const PT_PER_UNIT = 0.75;

/** Options for {@link exportRegionsPdf}. */
export interface ExportRegionsPdfOptions {
  /** The color painted under each page. Default none: the page is left unpainted. */
  background?: string | null;
  /** The document's title. */
  title?: string;
  /** The document's language, a BCP 47 tag. Default: the language every text on the pages shares, if they share one. */
  lang?: string;
}

/**
 * Write each of `regions` of `scene` as a page of one PDF, `region × 0.75`
 * points in size, in the order given, each labeled with its region's `name`.
 * Shapes and strokes are vector; text is real, selectable text in its
 * embedded face. What a PDF cannot draw is painted through the renderer and
 * placed as an image, and anything it could not carry at all comes back in
 * `skipped`. Annotation layers are left out.
 *
 * The caller has registered what the scene needs painting with, as for
 * `exportRegionPng`, including each font's outlines. Needs WebGL2 and
 * `OffscreenCanvas`.
 */
export async function exportRegionsPdf(
  scene: ExportScene,
  regions: readonly ExportRegion[],
  opts: ExportRegionsPdfOptions = {},
): Promise<{ blob: Blob; skipped: readonly PdfSkip[] }> {
  // A page's commands hold bitmaps while the next page's images load.
  const release = holdImageBitmaps();
  try {
    return await writeRegions(scene, regions, opts.background ?? null, opts);
  } finally {
    release();
  }
}

async function writeRegions(
  scene: ExportScene, regions: readonly ExportRegion[], background: string | null, opts: ExportRegionsPdfOptions,
): Promise<{ blob: Blob; skipped: readonly PdfSkip[] }> {
  const out: PdfPage[] = [];
  for (const region of regions) {
    const args = regionRenderArgs(scene, region, { scale: PT_PER_UNIT });
    await warmRender({ render: args });
    const plan = planPixelRender(args);
    const width = region.width * PT_PER_UNIT;
    const height = region.height * PT_PER_UNIT;
    // The planner sizes a background to whole pixels, which can stop short of the page's edge.
    const ground = background === null ? [] : [{
      kind: 'path' as const,
      path: { kind: 'rect' as const, x: 0, y: 0, width, height },
      fill: { paint: { kind: 'solid' as const, color: background } },
    }];
    out.push({
      width, height, commands: [...ground, ...plan.commands], view: viewToMat3(plan.view),
      ...(region.name !== undefined ? { label: region.name } : {}),
    });
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

/** What the `pdf` format reads beyond the options every format takes. */
export type PdfExportOptions = ExportOptions & Omit<ExportRegionsPdfOptions, 'background'>;

/**
 * The `pdf` format: every region as a page of one PDF, through
 * {@link exportRegionsPdf}. What the PDF could not carry goes to `onWarn`, one
 * call per thing left out.
 */
export const PDF_EXPORT: ExportFormat<PdfExportOptions> = {
  id: 'pdf',
  label: 'PDF Document',
  mimeType: 'application/pdf',
  extension: 'pdf',
  multiRegion: true,
  async export(scene, regions, { background, title, lang, onWarn }) {
    const { blob, skipped } = await exportRegionsPdf(scene, regions, {
      ...(background !== undefined ? { background } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(lang !== undefined ? { lang } : {}),
    });
    for (const skip of skipped) onWarn?.(skip.detail);
    return blob;
  },
};

/** Register the `pdf` export format with core's export registry. Returns the disposer. */
export function registerPdfExport(): () => void {
  return registerExportFormat(PDF_EXPORT);
}
