import { placedPagesOf } from 'core/pages/pageNodes';
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
 * single-region format takes one page. Each page is placed as the document
 * the export draws places it, found by its id; one the document no longer
 * holds fails the export.
 */
export function exportPages(
  scene: ExportScene,
  pages: readonly PlacedPage[],
  formatId: string,
  opts: ExportOptions & Readonly<Record<string, unknown>> = {},
): Promise<Blob> {
  const ids = pages.map((p) => p.id);
  return exportRegions(scene, (doc) => {
    const placed = new Map(placedPagesOf(doc).map((p) => [p.id, p]));
    return ids.map((id) => {
      const page = placed.get(id);
      if (page === undefined) throw new Error(`exportPages: the document holds no page "${id}"`);
      return pageRegion(page);
    });
  }, formatId, opts);
}
