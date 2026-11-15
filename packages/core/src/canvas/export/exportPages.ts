import { placedPagesOf } from 'core/pages/pageNodes';
import { pageName, type PlacedPage } from 'core/pages/pages';
import { exportRegions } from './exportFormats';
import type { ExportOptions, ExportRegion, ExportScene } from './exportTypes';

/** `page` as an export region, named as the page order shows it. */
export function pageRegion(page: PlacedPage): ExportRegion {
  return { x: page.x, y: page.y, width: page.width, height: page.height, name: pageName(page, page.index) };
}

/**
 * `pages` as regions read from the document an export draws: each page placed
 * as that document places it, found by its id, and named for it. A page the
 * document no longer holds fails the export.
 */
export function pageRegionsOf(pages: readonly PlacedPage[]): (doc: ExportScene) => readonly ExportRegion[] {
  const ids = pages.map((p) => p.id);
  return (doc) => {
    const placed = new Map(placedPagesOf(doc).map((p) => [p.id, p]));
    return ids.map((id) => {
      const page = placed.get(id);
      if (page === undefined) throw new Error(`exportPages: the document holds no page "${id}"`);
      return pageRegion(page);
    });
  };
}

/** One page as {@link pageRegionsOf} reads it: the region source of a single-region export. */
export function pageRegionOf(page: PlacedPage): (doc: ExportScene) => ExportRegion {
  const read = pageRegionsOf([page]);
  return (doc) => read(doc)[0]!;
}

/**
 * Write `pages` of `scene` in the format registered as `formatId`, each page
 * a region named for the page: `exportRegions` over {@link pageRegionsOf}. A
 * single-region format takes one page.
 */
export function exportPages(
  scene: ExportScene,
  pages: readonly PlacedPage[],
  formatId: string,
  opts: ExportOptions & Readonly<Record<string, unknown>> = {},
): Promise<Blob> {
  return exportRegions(scene, pageRegionsOf(pages), formatId, opts);
}
