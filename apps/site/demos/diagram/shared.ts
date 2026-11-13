/** What the diagram demos have in common: the port look, the type size, and
 *  how a drag's report is written back into the data. */
import { applyDiagramEdit, type DataEdge, type DataNode, type DiagramViewProps, type EdgeRoute, type NodeMove } from '@weasel-js/diagram';

export const FONT = { fontFamily: 'sans-serif', fontSize: 13 } as const;

export const PORTS: DiagramViewProps['portOptions'] = { fill: { paint: { color: '#e0913f' } }, cursor: 'crosshair' };

/** `nodes` with each moved one standing where it was moved to, unpinned: the
 *  demos build with `layout: 'none'`, and their layout buttons move them on. */
export function moved(nodes: readonly DataNode[], moves: readonly NodeMove[]): DataNode[] {
  return [...applyDiagramEdit({ nodes, edges: [] }, { moves, routes: [], containers: [] }, { pin: false }).nodes];
}

/** `edges` with each rerouted one keeping the route and ports a layout run
 *  wrote, as layout's own, so the next rebuild draws them. */
export function routed(edges: readonly DataEdge[], routes: readonly EdgeRoute[]): DataEdge[] {
  return [...applyDiagramEdit({ nodes: [], edges }, { moves: [], routes, containers: [] }).edges];
}
