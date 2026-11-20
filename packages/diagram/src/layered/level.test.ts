import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import type { Graph, GraphNode } from '../graph';
import { layeredPlan } from '../layered';
import type { LayoutDirection } from '../layout';

/** Every node pinned where it is given, and an edge for each pair. */
function pinnedGraph(at: Record<string, { x: number; y: number; height?: number }>, pairs: [string, string][]): Graph {
  const nodes: GraphNode[] = Object.entries(at).map(([id, p]) => ({ id, bounds: { width: 80, height: 30, ...p }, pinned: true }));
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

  it('goes around past a node between them that reaches further toward the next rank than either end', () => {
    const graph = pinnedGraph({ a: { x: 0, y: 30, height: 40 }, c: { x: 200, y: 0, height: 140 }, b: { x: 400, y: 30, height: 40 } }, [['a', 'b']]);
    const plan = layeredPlan(graph, { rankGap: 96 });
    expect(plan.waypoints.get('ab')).toEqual([{ x: 40, y: 188 }, { x: 440, y: 188 }]);
  });

  it('goes around a cluster box between them that neither end is in', () => {
    const graph = pinnedGraph({ a: { x: 0, y: 0 }, k1: { x: 200, y: -60 }, k2: { x: 200, y: 60 }, b: { x: 400, y: 0 } }, [['a', 'b']]);
    graph.nodes.find((n) => n.id === 'k1')!.cluster = 'K';
    graph.nodes.find((n) => n.id === 'k2')!.cluster = 'K';
    const clustered: Graph = { ...graph, clusters: [{ id: 'K', members: ['k1', 'k2'], inset: { top: 12, right: 12, bottom: 12, left: 12 } }] };
    const plan = layeredPlan(clustered, { rankGap: 96 });
    expect(plan.ports.get('ab')).toEqual({ from: 's', to: 's' });
    expect(plan.waypoints.get('ab')).toEqual([{ x: 40, y: 150 }, { x: 440, y: 150 }]);
  });

  it('runs straight across inside the cluster both ends are in', () => {
    const graph = pinnedGraph({ a: { x: 0, y: 0 }, b: { x: 400, y: 0 } }, [['a', 'b']]);
    for (const n of graph.nodes) n.cluster = 'K';
    const clustered: Graph = { ...graph, clusters: [{ id: 'K', members: ['a', 'b'], inset: { top: 12, right: 12, bottom: 12, left: 12 } }] };
    const plan = layeredPlan(clustered, { rankGap: 96 });
    expect(plan.ports.get('ab')).toEqual({ from: 'e', to: 'w' });
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
