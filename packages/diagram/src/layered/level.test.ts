import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import type { Graph, GraphNode } from '../graph';
import { layeredPlan } from '../layered';
import type { LayoutDirection } from '../layout';

/** Every node pinned where it is given, and an edge for each pair. */
function pinnedGraph(at: Record<string, { x: number; y: number }>, pairs: [string, string][]): Graph {
  const nodes: GraphNode[] = Object.entries(at).map(([id, p]) => ({ id, bounds: { ...p, width: 80, height: 30 }, pinned: true }));
  const edges = pairs.map(([from, to]) => ({ id: `${from}${to}`, from, to }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    nodes,
    edges,
    node: (id) => byId.get(id),
    outgoing: (id) => edges.filter((e) => e.from === id),
    incoming: (id) => edges.filter((e) => e.to === id),
  };
}

describe('layered, an edge between two nodes level along the rank axis', () => {
  it.each<[LayoutDirection, { x: number; y: number }, { from: string; to: string }]>([
    ['down', { x: 200, y: 0 }, { from: 'e', to: 'w' }],
    ['down', { x: -200, y: 10 }, { from: 'w', to: 'e' }],
    ['up', { x: 200, y: 0 }, { from: 'e', to: 'w' }],
    ['right', { x: 0, y: 100 }, { from: 's', to: 'n' }],
    ['left', { x: 0, y: -100 }, { from: 'n', to: 's' }],
  ])('laid out %s with b at %o, runs straight across between their facing sides', (direction, b, ports) => {
    const plan = layeredPlan(pinnedGraph({ a: { x: 0, y: 0 }, b }, [['a', 'b']]), { direction });
    expect(plan.ports.get('ab')).toEqual(ports);
    expect(plan.waypoints.get('ab')).toBeUndefined();
  });

  it('goes around beyond both, by the face toward the next rank, when a node sits between them', () => {
    const graph = pinnedGraph({ a: { x: 0, y: 0 }, m: { x: 200, y: 0 }, b: { x: 400, y: 0 } }, [['a', 'b']]);
    const plan = layeredPlan(graph, { rankGap: 96 });
    expect(plan.ports.get('ab')).toEqual({ from: 's', to: 's' });
    expect(plan.waypoints.get('ab')).toEqual([{ x: 40, y: 78 }, { x: 440, y: 78 }]);
  });

  it('goes around the way up, beyond both, when laid out up', () => {
    const graph = pinnedGraph({ a: { x: 0, y: 0 }, m: { x: 200, y: 0 }, b: { x: 400, y: 0 } }, [['a', 'b']]);
    const plan = layeredPlan(graph, { direction: 'up', rankGap: 96 });
    expect(plan.ports.get('ab')).toEqual({ from: 'n', to: 'n' });
    expect(plan.waypoints.get('ab')).toEqual([{ x: 40, y: -48 }, { x: 440, y: -48 }]);
  });

  it('turns short of a node beyond them that is nearer than half a rank gap', () => {
    const graph = pinnedGraph({ a: { x: 0, y: 0 }, m: { x: 200, y: 0 }, b: { x: 400, y: 0 }, z: { x: 200, y: 50 } }, [['a', 'b']]);
    const plan = layeredPlan(graph, { rankGap: 96 });
    expect(plan.waypoints.get('ab')).toEqual([{ x: 40, y: 40 }, { x: 440, y: 40 }]);
  });

  it('keeps the rank faces for nodes that are not level', () => {
    const plan = layeredPlan(pinnedGraph({ a: { x: 0, y: 0 }, b: { x: 200, y: 200 } }, [['a', 'b']]));
    expect(plan.ports.get('ab')).toEqual({ from: 's', to: 'n' });
  });

  it('names the side ports on the drawn edge', () => {
    const specs = diagramScene({
      nodes: [
        { id: 'a', lines: ['a'], at: { x: 0, y: 0 }, pinned: true },
        { id: 'b', lines: ['b'], at: { x: 300, y: 0 }, pinned: true },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    const edge = specs.find((s) => s.id?.startsWith('edge:'))!.data!.diagram as { from: { port?: string }; to: { port?: string } };
    expect([edge.from.port, edge.to.port]).toEqual(['e', 'w']);
  });
});
