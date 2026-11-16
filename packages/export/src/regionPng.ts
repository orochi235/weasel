import { holdImageBitmaps } from '@weasel-js/renderer';
import { createRasterSession, planPixelRender, rasterToPng, warmRender, type PixelRenderPlan, type RenderDiagnosticSink } from '@weasel-js/core';
import { captureExport, regionsOfOne } from './captureExport';
import { exportReporter } from './exportDiagnostics';
import type { ExportFormat, ExportOptions, ExportRegionSource, ExportScene } from './exportTypes';
import { regionRenderArgs } from './regionRenderArgs';

/** Options for {@link exportRegionPng}. */
export interface ExportRegionPngOptions extends Pick<ExportOptions, 'onDiagnostic' | 'strict'> {
  /** Output pixels per world unit: 2 makes an image twice the region's size. */
  scale: number;
  /** The color painted under the region. Default none: the image is transparent where nothing is drawn. */
  background?: string | null;
}

/** The plan a PNG of `region` draws, read through `captureExport` from one revision of the document, its faces,
 *  kinds and pictures loaded, and what it draws without told to `report`. */
export function capturePngRegion(
  scene: ExportScene, region: ExportRegionSource, opts: ExportRegionPngOptions, report?: RenderDiagnosticSink,
): Promise<PixelRenderPlan> {
  return captureExport(scene, regionsOfOne(region), {
    warm: (doc, [r], hear) => warmRender({ render: regionRenderArgs(doc, r!, opts), report: hear }),
    read: (doc, [r]) => planPixelRender(regionRenderArgs(doc, r!, opts)),
  }, report);
}

/**
 * Draw `region` of `scene` into a PNG, `region × scale` pixels, through the
 * renderer the canvas draws with, so it shows what the canvas shows, cut to
 * the region's edges. It draws the document: a gesture or edit in flight is
 * not shown. Annotation layers are left out.
 *
 * The caller has registered whatever the scene needs painting with, as it
 * must to draw it at all: its painters (`registerNodeShape`) and its fonts.
 * Paint kinds and faces that load on demand are waited for, and the image is
 * of one revision of the document: see `captureExport`. What it draws
 * without goes to `onDiagnostic`, and a `strict` export rejects with
 * `ExportIncompleteError` rather than write it. Needs WebGL2.
 */
export async function exportRegionPng(scene: ExportScene, region: ExportRegionSource, opts: ExportRegionPngOptions): Promise<Blob> {
  const reporter = exportReporter(opts);
  // The plan's pictures stay open until it is drawn.
  const release = holdImageBitmaps();
  try {
    const plan = await capturePngRegion(scene, region, opts, reporter.report);
    reporter.settle();
    const session = createRasterSession();
    try {
      return await rasterToPng(session.renderPlan(plan));
    } finally {
      session.dispose();
    }
  } finally {
    release();
  }
}

/** The `png` format's own option. */
export interface PngExportOptions extends ExportOptions {
  /** Output pixels per world unit. Default 1. */
  scale?: number;
}

/** The built-in `png` format: one region as a PNG image, through {@link exportRegionPng}. */
export const PNG_EXPORT: ExportFormat<PngExportOptions> = {
  id: 'png',
  label: 'PNG Image',
  mimeType: 'image/png',
  extension: 'png',
  multiRegion: false,
  options: ['scale'],
  export: (scene, regions, opts) => exportRegionPng(scene, typeof regions === 'function' ? (doc) => regions(doc)[0]! : regions[0]!, {
    scale: opts.scale ?? 1,
    ...(opts.background !== undefined ? { background: opts.background } : {}),
    ...(opts.onDiagnostic ? { onDiagnostic: opts.onDiagnostic } : {}),
    ...(opts.strict !== undefined ? { strict: opts.strict } : {}),
  }),
};
