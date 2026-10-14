import type { RenderLayer } from '../layers/render';
import type { PlacedPage } from './pages';

/** Options for {@link pagesLayer}. */
export interface PagesLayerOptions {
  /** Each page's color: one for all, or one per page. */
  fill: string | ((page: PlacedPage) => string);
  /** Default `'pages'`. */
  id?: string;
  /** Default `'Pages'`. */
  label?: string;
}

/**
 * The sheets themselves: a world-space layer that paints each placed page as a
 * filled rect, to sit under the scene. Build it again when the pages or the
 * fill change; its commands are cached on both.
 */
export function pagesLayer(pages: readonly PlacedPage[], options: PagesLayerOptions): RenderLayer<unknown> {
  const { fill, id = 'pages', label = 'Pages' } = options;
  const colorOf = typeof fill === 'function' ? fill : () => fill;
  return {
    id,
    label,
    deps: () => [pages, fill],
    draw: () =>
      pages.map((page) => ({
        kind: 'path' as const,
        path: { kind: 'rect' as const, x: page.x, y: page.y, width: page.width, height: page.height },
        fill: { paint: { kind: 'solid' as const, color: colorOf(page) } },
      })),
  };
}
