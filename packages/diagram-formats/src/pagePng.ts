/**
 * One page of a diagram as a PNG image.
 */
import { documentOf, rasterToPng, renderSceneToPixels, warmRender } from '@weasel-js/core';
import type { PageExportScene, PageRect } from './pageNodes';
import { pageBackground } from './pageSvg';

/** Options for {@link exportPagePng}. */
export interface ExportPagePngOptions {
  /** Output pixels per world unit: 2 makes an image twice the page's size. */
  scale: number;
  /** The color painted under the page. Default: the page color of the
   *  scene's diagram theme. `null` leaves it transparent. */
  background?: string | null;
}

/**
 * Draw `page` of `scene` into a PNG, `page × scale` pixels, through the
 * renderer the canvas draws with, so it shows what the canvas shows, cut to
 * the page's edges. It draws the document: a gesture or edit in flight is not
 * shown. Annotation layers are left out.
 *
 * The caller has registered whatever the scene needs painting with, as it
 * must to draw it at all: the diagram painters (`registerDiagramShape`,
 * `registerMarkShape`) and its fonts. Paint kinds and faces that load on
 * demand are waited for. Needs WebGL2.
 */
export async function exportPagePng(
  scene: PageExportScene,
  page: PageRect,
  opts: ExportPagePngOptions,
): Promise<Blob> {
  const background = pageBackground(scene, opts.background);
  const args = {
    // An export draws the document, not what an open gesture or edit is showing.
    scene: documentOf(scene),
    sourceRect: { x: page.x, y: page.y, width: page.width, height: page.height },
    scale: { x: opts.scale, y: opts.scale },
    ...(background !== null ? { background } : {}),
  };
  await warmRender({ render: args });
  return rasterToPng(renderSceneToPixels(args));
}
