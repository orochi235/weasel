/**
 * A page of a diagram as a file: `@weasel-js/export`'s page exports, drawn
 * with the diagram painters and on the diagram theme's page color.
 */
import type { RectPose } from '@weasel-js/core';
import { diagramShape, diagramThemeOf, markShape } from '@weasel-js/diagram';
import {
  exportPagePng as exportScenePagePng,
  exportPageSvg as exportScenePageSvg,
  exportPagesPdf as exportScenePagesPdf,
  pageSvgNodes as scenePageSvgNodes,
  type ExportPagePngOptions as ScenePagePngOptions,
  type ExportPageSvgOptions as ScenePageSvgOptions,
  type ExportPagesPdfOptions as ScenePagesPdfOptions,
  type PageExportScene,
  type PageRect,
} from '@weasel-js/export';
import type { PdfSkip } from '@weasel-js/pdf';
import type { SvgNode } from '@weasel-js/svg';

export type { PageExportScene, PageRect } from '@weasel-js/export';

/** Options for {@link exportPageSvg}. */
export interface ExportPageSvgOptions extends Omit<ScenePageSvgOptions, 'background' | 'painters'> {
  /** The color painted under the page. Default: the page color of the
   *  scene's diagram theme (`diagram:theme`). `null` paints none. */
  background?: string | null;
}

/** Options for {@link exportPagePng}. */
export interface ExportPagePngOptions extends Omit<ScenePagePngOptions, 'background'> {
  /** The color painted under the page. Default: the page color of the
   *  scene's diagram theme. `null` leaves it transparent. */
  background?: string | null;
}

/** Options for {@link exportPagesPdf}. */
export interface ExportPagesPdfOptions extends Omit<ScenePagesPdfOptions, 'background'> {
  /** The color painted under each page. Default: the page color of the
   *  scene's diagram theme. `null` leaves it unpainted. */
  background?: string | null;
}

/** The page color a page export paints when told none: the scene theme's. */
const pageBackground = (scene: PageExportScene, background: string | null | undefined): string | null =>
  background === undefined ? diagramThemeOf(scene).page : background;

const painters = () => [diagramShape<RectPose>(), markShape<RectPose>()];

/**
 * The `SvgNode`s of everything on `page`, as `@weasel-js/export`'s
 * `pageSvgNodes` writes them, with diagram outlines and drawn marks drawn by
 * the diagram painters whether or not they are registered.
 */
export function pageSvgNodes(scene: PageExportScene, page: PageRect): SvgNode[] {
  return scenePageSvgNodes(scene, page, { painters: painters() });
}

/**
 * Write `page` of `scene` as an SVG document, as `@weasel-js/export`'s
 * `exportPageSvg` does, drawing diagram outlines and marks with the diagram
 * painters, on the diagram theme's page color unless told otherwise.
 */
export function exportPageSvg(scene: PageExportScene, page: PageRect, opts: ExportPageSvgOptions = {}): Promise<string> {
  return exportScenePageSvg(scene, page, { ...opts, painters: painters(), background: pageBackground(scene, opts.background) });
}

/**
 * Draw `page` of `scene` into a PNG, as `@weasel-js/export`'s `exportPagePng`
 * does, on the diagram theme's page color unless told otherwise. The caller
 * has registered the diagram painters (`registerDiagramShape`,
 * `registerMarkShape`) and the fonts the scene uses. Needs WebGL2.
 */
export function exportPagePng(scene: PageExportScene, page: PageRect, opts: ExportPagePngOptions): Promise<Blob> {
  return exportScenePagePng(scene, page, { ...opts, background: pageBackground(scene, opts.background) });
}

/**
 * Write each of `pages` of `scene` as a page of one PDF, as
 * `@weasel-js/export`'s `exportPagesPdf` does, on the diagram theme's page
 * color unless told otherwise. The caller has registered what the scene needs
 * painting with, as for {@link exportPagePng}, including each font's outlines.
 */
export function exportPagesPdf(
  scene: PageExportScene, pages: readonly PageRect[], opts: ExportPagesPdfOptions = {},
): Promise<{ blob: Blob; skipped: readonly PdfSkip[] }> {
  return exportScenePagesPdf(scene, pages, { ...opts, background: pageBackground(scene, opts.background) });
}
