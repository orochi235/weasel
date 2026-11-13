import { pageName, type PlacedPage } from 'core/pages/pages';
import { exportRegions } from './exportFormats';
import type { ExportOptions, ExportRegion, ExportScene } from './exportTypes';

/** `page` as an export region, named as the page order shows it. */
export function pageRegion(page: PlacedPage): ExportRegion {
  return { x: page.x, y: page.y, width: page.width, height: page.height, name: pageName(page, page.index) };
}

/**
 * Write `pages` of `scene` in the format registered as `formatId`, each page
 * a region named for the page: `exportRegions` over the pages. A
 * single-region format takes one page.
 */
export function exportPages(
  scene: ExportScene,
  pages: readonly PlacedPage[],
  formatId: string,
  opts: ExportOptions & Readonly<Record<string, unknown>> = {},
): Promise<Blob> {
  return exportRegions(scene, pages.map(pageRegion), formatId, opts);
}
