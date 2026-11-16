/**
 * Regions of a scene as one PDF, a page each, and the `pdf` export format.
 */
import {
  commandRasterizer, createRasterSession, holdImageBitmaps, planPixelRender, viewToMat3, warmRender, type RenderDiagnosticSink,
} from '@weasel-js/core';
import {
  captureExport, exportReporter, regionRenderArgs, registerExportFormat, type ExportDiagnostic, type ExportFormat,
  type ExportOptions, type ExportRegion, type ExportRegions, type ExportScene,
} from '@weasel-js/export';
import { registryFontSource } from './fonts/fontSource';
import { writePdf, type PdfPage, type PdfSkip } from './writePdf';

/** PDF points per world unit: 72 points to the inch over 96 units to the inch. */
const PT_PER_UNIT = 0.75;

/** Options for {@link exportRegionsPdf}. */
export interface ExportRegionsPdfOptions extends Pick<ExportOptions, 'onDiagnostic' | 'strict'> {
  /** The color painted under each page. Default none: the page is left unpainted. */
  background?: string | null;
  /** The document's title. */
  title?: string;
  /** The document's language, a BCP 47 tag. Default: the language every text on the pages shares, if they share one. */
  lang?: string;
  /** Deflate the page and image streams. Default `true`; `false` leaves them readable. */
  compress?: boolean;
}

/**
 * Write each of `regions` of `scene` as a page of one PDF, `region × 0.75`
 * points in size, in the order given, each labeled with its region's `name`.
 * Shapes and strokes are vector; text is real, selectable text in its
 * embedded face. What a PDF cannot draw is painted through the renderer and
 * placed as an image. What it could not carry at all, and what failed to
 * load, goes to `onDiagnostic`, and a `strict` export rejects with
 * `ExportIncompleteError` rather than write the file. Annotation layers are
 * left out.
 *
 * Every page is of one revision of the document, bounds read from it
 * included: see `captureExport`.
 *
 * The caller has registered what the scene needs painting with, as for
 * `exportRegionPng`, including each font's outlines. What a PDF cannot draw
 * is painted with WebGL2 and `OffscreenCanvas`.
 */
export async function exportRegionsPdf(
  scene: ExportScene,
  regions: ExportRegions,
  opts: ExportRegionsPdfOptions = {},
): Promise<Blob> {
  const reporter = exportReporter(opts);
  // A page's commands hold bitmaps while the next page's images load.
  const release = holdImageBitmaps();
  try {
    const blob = await writeRegions(scene, regions, opts.background ?? null, opts, reporter.report);
    reporter.settle();
    return blob;
  } finally {
    release();
  }
}

/** What the writer left out, as the diagnostic an export reports. */
function skipDiagnostic(skip: PdfSkip): ExportDiagnostic {
  return skip.kind === 'glyph'
    ? { kind: 'font', subject: 'pdf', message: skip.detail }
    : { kind: 'unsupported', subject: 'pdf', message: skip.detail };
}

/** Every region of `doc` as a page: its size in points, and the commands it is drawn with. */
function pagesOf(doc: ExportScene, regions: readonly ExportRegion[], background: string | null): PdfPage[] {
  return regions.map((region) => {
    const plan = planPixelRender(regionRenderArgs(doc, region, { scale: PT_PER_UNIT }));
    const width = region.width * PT_PER_UNIT;
    const height = region.height * PT_PER_UNIT;
    // The planner sizes a background to whole pixels, which can stop short of the page's edge.
    const ground = background === null ? [] : [{
      kind: 'path' as const,
      path: { kind: 'rect' as const, x: 0, y: 0, width, height },
      fill: { paint: { kind: 'solid' as const, color: background } },
    }];
    return {
      width, height, commands: [...ground, ...plan.commands], view: viewToMat3(plan.view),
      ...(region.name !== undefined ? { label: region.name } : {}),
    };
  });
}

async function writeRegions(
  scene: ExportScene, regions: ExportRegions, background: string | null, opts: ExportRegionsPdfOptions, report: RenderDiagnosticSink,
): Promise<Blob> {
  const out = await captureExport(scene, regions, {
    warm: async (doc, rs, hear) => {
      await Promise.all(rs.map((r) => warmRender({ render: regionRenderArgs(doc, r, { scale: PT_PER_UNIT }), report: hear })));
    },
    read: (doc, rs) => pagesOf(doc, rs, background),
  }, report);

  const session = createRasterSession();
  try {
    const { bytes, skipped } = await writePdf(out, {
      fonts: registryFontSource,
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.lang !== undefined ? { lang: opts.lang } : {}),
      ...(opts.compress !== undefined ? { compress: opts.compress } : {}),
      rasterize: commandRasterizer(session),
    });
    for (const skip of skipped) report(skipDiagnostic(skip));
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return new Blob([copy], { type: 'application/pdf' });
  } finally {
    session.dispose();
  }
}

/** What the `pdf` format reads beyond the options every format takes. */
export type PdfExportOptions = ExportOptions & Omit<ExportRegionsPdfOptions, 'background' | 'onDiagnostic' | 'strict'>;

/**
 * The `pdf` format: every region as a page of one PDF, through
 * {@link exportRegionsPdf}.
 */
export const PDF_EXPORT: ExportFormat<PdfExportOptions> = {
  id: 'pdf',
  label: 'PDF Document',
  mimeType: 'application/pdf',
  extension: 'pdf',
  multiRegion: true,
  export(scene, regions, { background, title, lang, compress, onDiagnostic, strict }) {
    const picked = { background, title, lang, compress, onDiagnostic, strict };
    return exportRegionsPdf(scene, regions, Object.fromEntries(Object.entries(picked).filter(([, v]) => v !== undefined)));
  },
};

/** Register the `pdf` export format with `@weasel-js/export`'s registry. Returns the disposer. */
export function registerPdfExport(): () => void {
  return registerExportFormat(PDF_EXPORT, { fallback: true });
}
