import { describe, expect, it } from 'vitest';
import type { Graph, GraphNode } from '../graph';
import { planPass, routed } from './plan';

describe('layeredPlan, seeding a pass from the last', () => {
  const node = (id: string, x: number, pinned: boolean): GraphNode => ({ id, bounds: { x, y: 0, width: 80, height: 30 }, pinned });
  const nodes = [node('a', 0, true), node('c', 300, true), node('b', 600, true), node('m', 0, false), node('q', 0, false)];
  const edges = [
    { id: 'am', from: 'a', to: 'm' },
    { id: 'mb', from: 'm', to: 'b' },
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'mq', from: 'm', to: 'q' },
    { id: 'aq', from: 'a', to: 'q' },
  ];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const graph: Graph = { nodes, edges, node: (id) => byId.get(id), outgoing: (id) => edges.filter((e) => e.from === id), incoming: (id) => edges.filter((e) => e.to === id) };

  it('reads no seed from a level edge’s detour, which says nothing of where it crosses a rank', () => {
    const pass = planPass(graph, { rankGap: 96 });
    expect(pass.plan.waypoints.get('ab')).toHaveLength(2);
    expect(routed(edges[2]!, pass).waypoints).toBeUndefined();
  });

  it('seeds an edge spanning ranks from the route it was given', () => {
    const pass = planPass(graph, { rankGap: 96 });
    expect(routed(edges[4]!, pass).waypoints).toEqual(pass.plan.waypoints.get('aq'));
    expect(pass.plan.waypoints.get('aq')).toHaveLength(2);
  });
});
