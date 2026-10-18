/** What the diagram demos have in common: the port look, the type size, and
 *  how a drag's report is written back into the data. */
import { edgeIdOf, type DataEdge, type DataNode, type DiagramViewProps, type EdgeRoute, type NodeMove } from '@weasel-js/diagram';

export const FONT = { fontFamily: 'sans-serif', fontSize: 13 } as const;

export const PORTS: DiagramViewProps['portOptions'] = { fill: { paint: { color: '#e0913f' } }, cursor: 'crosshair' };

/** `nodes` with each moved one standing where it was moved to. Enough under
 *  `layout: 'none'`; a diagram that lays itself out also pins them. */
export function moved(nodes: readonly DataNode[], moves: readonly NodeMove[]): DataNode[] {
  const at = new Map(moves.map((m) => [m.id, { x: m.x, y: m.y }]));
  return nodes.map((n) => {
    const to = at.get(n.id);
    return to === undefined ? n : { ...n, at: to };
  });
}

/** `edges` with each rerouted one keeping the route and ports a layout run
 *  wrote, as layout's own, so the next rebuild draws them. */
export function routed(edges: readonly DataEdge[], routes: readonly EdgeRoute[]): DataEdge[] {
  if (routes.length === 0) return [...edges];
  const by = new Map(routes.map((r) => [r.id, r]));
  return edges.map((e) => {
    const to = by.get(edgeIdOf(e));
    return to === undefined ? e : { ...e, routed: to.waypoints, routedPorts: to.ports };
  });
}
