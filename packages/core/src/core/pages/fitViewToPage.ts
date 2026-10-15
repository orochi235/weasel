import {
  fitViewToBounds,
  type FitViewToBoundsOptions,
  type ViewportDims,
} from '../viewport/fitViewToBounds';
import type { View } from '../viewport/view';
import type { PlacedPage } from './pages';

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
