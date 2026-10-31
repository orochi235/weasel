import { fitViewToBounds, pagesOf, placedPagesOf, type View } from '@weasel-js/core';
import { useCallback, useMemo, useState } from 'react';
import { CHART_PAGE, type ChartScene } from '../chartDocument';
import { PAGE_FIT_PADDING } from './useChartPages';

const NO_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const FALLBACK_PAGE = { id: null, x: 0, y: 0, ...CHART_PAGE };

export interface FittedView {
  view: View;
  /** Moves the view, which stops it following the workspace's size. */
  setView: (view: View) => void;
  /** Fits page `id`, or the first page, and follows the workspace's size again. */
  fitTo: (id: string | null) => void;
}

/**
 * The chart's view: a page fitted to the workspace, worked out from the workspace's size in the render that size
 * arrives in, until the view is moved. The toolbar's palette fills in after the first fit and shrinks the
 * workspace, and a fit set from an effect would reach the canvas a render after its new size.
 */
export function useFittedView(scene: ChartScene, dims: { width: number; height: number }): FittedView {
  const [moved, setMoved] = useState<View | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const doc = pagesOf(scene);
  const placed = useMemo(() => (doc ? placedPagesOf(scene) : []), [scene, doc]);
  const page = placed.find((p) => p.id === pageId) ?? placed[0] ?? FALLBACK_PAGE;
  const { x, y, width, height } = page;
  const { width: w, height: h } = dims;
  const fit = useMemo(
    () => (w > 0 && h > 0 ? fitViewToBounds({ x, y, width, height }, { width: w, height: h }, NO_VIEW, { padding: PAGE_FIT_PADDING }) : NO_VIEW),
    [x, y, width, height, w, h],
  );
  const fitTo = useCallback((id: string | null) => {
    setPageId(id);
    setMoved(null);
  }, []);
  return { view: moved ?? fit, setView: setMoved, fitTo };
}
