/**
 * A page of a diagram as a file: the region exports of core, svg and pdf,
 * drawn with the diagram painters and on the diagram theme's page color.
 */
import type { RectPose } from '@weasel-js/core';
import { exportRegionPng, type ExportRegion, type ExportRegionPngOptions, type ExportScene } from '@weasel-js/export';
import { diagramShape, diagramThemeOf, markShape } from '@weasel-js/diagram';
import { exportRegionsPdf, type ExportRegionsPdfOptions } from '@weasel-js/pdf/export';
import { exportRegionSvg, regionSvgNodes, type ExportRegionSvgOptions, type SvgNode } from '@weasel-js/svg';

/** A scene as the page exports read it: world-space `RectPose`s. `@weasel-js/export`'s `ExportScene`. */
export type PageExportScene = ExportScene;

/** A page's rect in world space. A `PlacedPage` is one. */
export type PageRect = Pick<ExportRegion, 'x' | 'y' | 'width' | 'height'>;

/**
 * A page as the page exports take it: a fixed rect, or a function reading it
 * from the document the export draws, as `@weasel-js/export`'s `pageRegionOf(page)` does, so
 * the page's bounds come from the revision drawn in them.
 */
export type PageSource = PageRect | ((doc: PageExportScene) => PageRect);

/** Pages as {@link exportPagesPdf} takes them: fixed rects, or a function reading them from the document, as `pageRegionsOf(pages)` does. */
export type PagesSource = readonly PageRect[] | ((doc: PageExportScene) => readonly PageRect[]);

/** Options for {@link exportPageSvg}. */
export interface ExportPageSvgOptions extends Omit<ExportRegionSvgOptions, 'background' | 'painters'> {
  /** The color painted under the page. Default: the page color of the
   *  scene's diagram theme (`diagram:theme`). `null` paints none. */
  background?: string | null;
}

/** Options for {@link exportPagePng}. */
export interface ExportPagePngOptions extends Omit<ExportRegionPngOptions, 'background'> {
  /** The color painted under the page. Default: the page color of the
   *  scene's diagram theme. `null` leaves it transparent. */
  background?: string | null;
}

/** Options for {@link exportPagesPdf}. */
export interface ExportPagesPdfOptions extends Omit<ExportRegionsPdfOptions, 'background'> {
  /** The color painted under each page. Default: the page color of the
   *  scene's diagram theme. `null` leaves it unpainted. */
  background?: string | null;
}

/** The page color a page export paints when told none: the scene theme's. */
const pageBackground = (scene: PageExportScene, background: string | null | undefined): string | null =>
  background === undefined ? diagramThemeOf(scene).page : background;

const painters = () => [diagramShape<RectPose>(), markShape<RectPose>()];

/** `page` as a bare rect: a page's name titles neither its SVG nor its PDF page here. */
const rectOf = ({ x, y, width, height }: PageRect) => ({ x, y, width, height });

const sourceOf = (page: PageSource) =>
  typeof page === 'function' ? (doc: PageExportScene) => rectOf(page(doc)) : rectOf(page);

/**
 * The `SvgNode`s of everything on `page`, as `@weasel-js/svg`'s
 * `regionSvgNodes` writes them, with diagram outlines and drawn marks drawn by
 * the diagram painters whether or not they are registered.
 */
export function pageSvgNodes(scene: PageExportScene, page: PageRect): SvgNode[] {
  return regionSvgNodes(scene, rectOf(page), { painters: painters() });
}

/**
 * Write `page` of `scene` as an SVG document, as `@weasel-js/svg`'s
 * `exportRegionSvg` does, drawing diagram outlines and marks with the diagram
 * painters, on the diagram theme's page color unless told otherwise.
 */
export function exportPageSvg(scene: PageExportScene, page: PageSource, opts: ExportPageSvgOptions = {}): Promise<string> {
  return exportRegionSvg(scene, sourceOf(page), { ...opts, painters: painters(), background: pageBackground(scene, opts.background) });
}

/**
 * Draw `page` of `scene` into a PNG, as `@weasel-js/export`'s `exportRegionPng`
 * does, on the diagram theme's page color unless told otherwise. The caller
 * has registered the diagram painters (`registerDiagramShape`,
 * `registerMarkShape`) and the fonts the scene uses. Needs WebGL2.
 */
export function exportPagePng(scene: PageExportScene, page: PageSource, opts: ExportPagePngOptions): Promise<Blob> {
  return exportRegionPng(scene, sourceOf(page), { ...opts, background: pageBackground(scene, opts.background) });
}

/**
 * Write each of `pages` of `scene` as a page of one PDF, as
 * `@weasel-js/pdf/export`'s `exportRegionsPdf` does, on the diagram theme's page
 * color unless told otherwise. The caller has registered what the scene needs
 * painting with, as for {@link exportPagePng}, including each font's outlines.
 */
export function exportPagesPdf(
  scene: PageExportScene, pages: PagesSource, opts: ExportPagesPdfOptions = {},
): Promise<Blob> {
  const regions = typeof pages === 'function' ? (doc: PageExportScene) => pages(doc).map(rectOf) : pages.map(rectOf);
  return exportRegionsPdf(scene, regions, { ...opts, background: pageBackground(scene, opts.background) });
}
