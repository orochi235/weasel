import { describe, expect, it } from 'vitest';
import type { GraphCluster, GraphNode } from '../graph';
import { axesFor } from '../layout';
import { settleAcross } from './across';

const INSET = { top: 12, right: 12, bottom: 12, left: 12 };
const node = (id: string, x: number, cluster?: string): GraphNode => ({ id, bounds: { x, y: 0, width: 80, height: 30 }, pinned: false, ...(cluster !== undefined ? { cluster } : {}) });

/** `nodes` in one rank at their x, with `held` pins at theirs. */
function settle(nodes: GraphNode[], clusters: GraphCluster[], held: Record<string, number>) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return settleAcross({
    graph: { nodes, edges: [], clusters, node: (id) => byId.get(id), outgoing: () => [], incoming: () => [] },
    rows: [nodes],
    preferred: new Map(nodes.map((n) => [n.id, n.bounds.x])),
    held: new Map(Object.entries(held)),
    axes: axesFor('down'),
    nodeGap: 20,
  });
}

describe('settleAcross, a cluster column', () => {
  it('is as wide as the box its minWidth widens, so a pin held inside that box is refused', () => {
    // C's box is 200 wide, centered on c: -60 to 140.
    const clusters = [{ id: 'C', members: ['c'], inset: INSET, minWidth: 200 }];
    expect(settle([node('c', 0, 'C'), node('p', 120)], clusters, { c: 0, p: 120 })).toBeUndefined();
    expect(settle([node('c', 0, 'C'), node('p', 160)], clusters, { c: 0, p: 160 })).toBeDefined();
  });

  it('pads by a nested cluster only on the side where it is outermost', () => {
    // P's box runs from a's low edge to b's high edge, 12 out: -12 to 332.
    const clusters = [
      { id: 'P', members: ['a', 'C', 'c', 'b'], inset: INSET },
      { id: 'C', members: ['c'], inset: INSET, parent: 'P' },
    ];
    expect(settle([node('a', 0, 'P'), node('c', 120, 'C'), node('b', 240, 'P'), node('q', 352)], clusters, { a: 0, q: 352 })).toBeDefined();
  });
});
