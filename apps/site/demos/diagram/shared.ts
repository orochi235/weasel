/** What the diagram demos have in common: the port look, the type size, and
 *  how a drag's report is written back into the data. */
import type { DataNode, DiagramViewProps, NodeMove } from '@weasel-js/diagram';

export const FONT = { fontFamily: 'sans-serif', fontSize: 13 } as const;

export const PORTS: DiagramViewProps['portOptions'] = { fill: { color: '#e0913f' }, cursor: 'crosshair' };

/** `nodes` with each moved one standing where it was moved to. Enough under
 *  `layout: 'none'`; a diagram that lays itself out also pins them. */
export function moved(nodes: readonly DataNode[], moves: readonly NodeMove[]): DataNode[] {
  const at = new Map(moves.map((m) => [m.id, { x: m.x, y: m.y }]));
  return nodes.map((n) => {
    const to = at.get(n.id);
    return to === undefined ? n : { ...n, at: to };
  });
}
