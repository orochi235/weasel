import type { View } from '@weasel-js/core';
import { usePages, type DocPages } from '@editor/index';
import type { ChartScene } from '../chartDocument';

/** What fits the view to a page leaves around it, in screen pixels. */
export const PAGE_FIT_PADDING = 24;

/** A chart's pages, which one the view is on, and what can be done to them. */
export type ChartPages = DocPages;

/** The chart's pages, read from the scene's `core:pages` value, with the view following them. */
export function useChartPages(
  scene: ChartScene,
  view: View,
  dims: { width: number; height: number },
  setView: (view: View) => void,
): ChartPages {
  return usePages(scene, view, dims, setView, PAGE_FIT_PADDING);
}
