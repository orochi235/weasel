import { rasterToPng } from '../rasterToPng';
import { renderSceneToPixels } from '../renderSceneToPixels';
import { warmRender } from '../warmRender';
import type { ExportFormat, ExportOptions, ExportRegion, ExportScene } from './exportTypes';
import { regionRenderArgs } from './regionRenderArgs';

/** Options for {@link exportRegionPng}. */
export interface ExportRegionPngOptions {
  /** Output pixels per world unit: 2 makes an image twice the region's size. */
  scale: number;
  /** The color painted under the region. Default none: the image is transparent where nothing is drawn. */
  background?: string | null;
}

/**
 * Draw `region` of `scene` into a PNG, `region × scale` pixels, through the
 * renderer the canvas draws with, so it shows what the canvas shows, cut to
 * the region's edges. It draws the document: a gesture or edit in flight is
 * not shown. Annotation layers are left out.
 *
 * The caller has registered whatever the scene needs painting with, as it
 * must to draw it at all: its painters (`registerNodeShape`) and its fonts.
 * Paint kinds and faces that load on demand are waited for. Needs WebGL2.
 */
export async function exportRegionPng(scene: ExportScene, region: ExportRegion, opts: ExportRegionPngOptions): Promise<Blob> {
  const args = regionRenderArgs(scene, region, opts);
  await warmRender({ render: args });
  return rasterToPng(renderSceneToPixels(args));
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
  export: (scene, regions, opts) => exportRegionPng(scene, regions[0]!, {
    scale: opts.scale ?? 1,
    ...(opts.background !== undefined ? { background: opts.background } : {}),
  }),
};
