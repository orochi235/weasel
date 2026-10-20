import {
  fitViewToBounds,
  type FitViewToBoundsOptions,
  type ViewportDims,
} from '../viewport/fitViewToBounds';
import type { View } from '../viewport/view';
import { pageOfBounds, type PlacedPage } from './pages';

/** The view that shows one placed page whole: `fitViewToBounds` on its rect. */
export function fitViewToPage(
  page: PlacedPage,
  viewportDims: ViewportDims,
  currentView: View,
  options?: FitViewToBoundsOptions,
): View {
  const { x, y, width, height } = page;
  return fitViewToBounds({ x, y, width, height }, viewportDims, currentView, options);
}

/** The page the view shows most of: the one overlapping the visible world rect most, or `null` when none shows. */
export function pageInView(
  pages: readonly PlacedPage[],
  view: View,
  viewportDims: ViewportDims,
): PlacedPage | null {
  const visible = { x: view.x, y: view.y, width: viewportDims.width / view.scale.x, height: viewportDims.height / view.scale.y };
  return pageOfBounds(pages, visible);
}
