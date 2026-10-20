import { PAGES_DOC_KEY, type PagesDoc, type RectPose, type Scene, type SceneRegistry, type SerializedDoc, type Stroke } from '@weasel-js/core';
import { withDiagramRegistry, type DiagramSceneData, type NodeStyle } from '@weasel-js/diagram';

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

/** The pages of a new chart, and of one saved before charts had pages: one, at the chart page size. */
export const CHART_PAGES: PagesDoc = { pages: [{ id: 'page-1', width: CHART_PAGE.width, height: CHART_PAGE.height }] };

/** `doc` with its page list, or {@link CHART_PAGES} where it has none. */
export function chartDoc(doc: SerializedDoc = {}): SerializedDoc {
  return { ...doc, [PAGES_DOC_KEY]: doc[PAGES_DOC_KEY] ?? CHART_PAGES };
}

/** Ink for a white page: the kit's diagram defaults are drawn for a dark ground. */
const INK = '#1f2933';
export const CHART_NODE_STYLE: NodeStyle = { fill: '#ffffff', stroke: '#3e4c59', text: INK };
export const CHART_EDGE_STROKE: Stroke = { paint: { color: '#3e4c59' }, width: 2, markerEnd: 'arrow' };
export const CHART_LABEL_FILL = INK;
