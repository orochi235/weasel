import { describe, expect, it } from 'vitest';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Graph, GraphEdge, GraphNode } from '@weasel-js/diagram/layout';
import { elkRootOptions } from './elkPlan';
import { fromElk } from './fromElk';
import { toElk } from './toElk';

function node(id: string): GraphNode {
  return { id, bounds: { x: 0, y: 0, width: 80, height: 40 }, pinned: false };
}

function graphOf(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return { nodes, edges, node: (id) => byId.get(id), outgoing: () => [], incoming: () => [] };
}

const offsetLabel = graphOf([node('a'), node('b')], [{ id: 'ab', from: 'a', to: 'b', label: { width: 40, height: 16, offset: 30 } }]);

describe('toElk', () => {
  for (const [direction, cross] of [['down', 'width'], ['right', 'height']] as const) {
    it(`leaves room for a label set off its wire on either side, centered on the wire, ranks running ${direction}`, async () => {
      const { root, index } = toElk(offsetLabel, elkRootOptions({ direction }));
      const label = root.edges![0]!.labels![0]!;
      // The label's far side is `offset` plus its own extent off the wire, on whichever side it names.
      expect(label[cross]).toBe(2 * (30 + (cross === 'width' ? 40 : 16)));
      const placed = fromElk(await new ELK().layout(root), index);
      const box = placed.labels.get('ab')!;
      const route = placed.routes.get('ab')!;
      // The wire runs through the middle of the room (to ELK's rounding), so the label, on either side, sits inside it.
      const axis = cross === 'width' ? 'x' : 'y';
      const mid = box[axis] + box[cross] / 2;
      expect(route.some((p, i) => i > 0 && Math.abs(route[i - 1]![axis] - mid) <= 1 && Math.abs(p[axis] - mid) <= 1)).toBe(true);
    });
  }

  it('hands ELK a label with no offset at its own size', () => {
    const plain = graphOf([node('a'), node('b')], [{ id: 'ab', from: 'a', to: 'b', label: { width: 40, height: 16 } }]);
    const label = toElk(plain, elkRootOptions()).root.edges![0]!.labels![0]!;
    expect([label.width, label.height, label.layoutOptions]).toEqual([40, 16, undefined]);
  });
});
