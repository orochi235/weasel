import type { RectPose, Scene, SceneRegistry } from '@weasel-js/core';
import { withDiagramRegistry, type DiagramSceneData } from '@weasel-js/diagram';

/** A chart is a diagram scene: stencil bodies, their text rows, edges and edge labels. */
export type ChartData = DiagramSceneData;
export type ChartLayer = 'shapes';
export type ChartPose = RectPose;
export type ChartScene = Scene<ChartData, ChartLayer, ChartPose>;

export const CHART_LAYERS: readonly { id: ChartLayer }[] = [{ id: 'shapes' }];

/** Edges and labels derive their geometry by registry key, so a saved chart finds them again. */
export const CHART_REGISTRY: SceneRegistry<ChartPose, ChartData, ChartLayer> =
  withDiagramRegistry<ChartPose, ChartData, ChartLayer>();

/** The page a chart is drawn on: US Letter, landscape, at 96 per inch. */
export const CHART_PAGE = { width: 1056, height: 816 } as const;
export const CHART_PAGE_COLOR = '#ffffff';
