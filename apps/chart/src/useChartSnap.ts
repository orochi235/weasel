import type { FeatureEntry, RenderLayer, SceneCanvasSnap, SceneNode } from '@weasel-js/core';
import { diagramEdgeOf, diagramLabelOf } from '@weasel-js/diagram';
import { createSpacingHintsPreset } from '@weasel-js/guides';
import { usePageGrid } from '@editor/index';
import { useMemo } from 'react';
import { CHART_PAGE, CHART_PAGE_COLOR } from './chartDocument';
import { useChartPref } from './prefs';

/** A heavier line every inch at the default 12 per line. */
const ACCENT_EVERY = 8;

/** Connectors and their labels are top-level siblings of the bodies; only bodies are lined up with. */
const isBody = (node: SceneNode<unknown, string, unknown>): boolean =>
  diagramEdgeOf(node) === null && diagramLabelOf(node) === null;

export interface ChartSnap {
  gridLayer: RenderLayer<unknown> | undefined;
  snap: SceneCanvasSnap;
  features: readonly FeatureEntry[];
}

/** Chart mode's grid and snapping, from the View preferences. Each value keeps its identity until its prefs change. */
export function useChartSnap(): ChartSnap {
  const [visible] = useChartPref('view.gridVisible');
  const [spacing] = useChartPref('view.gridSpacing');
  const [snapToGrid] = useChartPref('view.snapToGrid');
  const [align] = useChartPref('view.alignmentSnap');
  const [spacingSnap] = useChartPref('view.spacingSnap');

  const grid = usePageGrid({
    page: CHART_PAGE, spacing, background: CHART_PAGE_COLOR, accentEvery: ACCENT_EVERY, visible, snap: snapToGrid,
  });
  const source = grid.source;
  const snap = useMemo<SceneCanvasSnap>(() => ({ sources: source ? [source] : [] }), [source]);

  const features = useMemo<readonly FeatureEntry[]>(() => {
    if (!align && !spacingSnap) return ['draw'];
    return ['draw', createSpacingHintsPreset({ spacing: spacingSnap, align, filter: isBody, ...(spacingSnap ? {} : { readout: false }) })];
  }, [align, spacingSnap]);

  return { gridLayer: grid.layer, snap, features };
}
