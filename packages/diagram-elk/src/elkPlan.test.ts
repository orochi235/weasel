import { describe, expect, it } from 'vitest';
import type { Graph, GraphEdge, GraphGroup, GraphNode } from '@weasel-js/diagram/layout';
import { elkLayout, elkPlan, elkPlanner } from './elkPlan';

const INSET = { top: 30, right: 12, bottom: 12, left: 12 };

function node(id: string, extra: Partial<GraphNode> = {}): GraphNode {
  return { id, bounds: { x: 0, y: 0, width: 80, height: 40 }, pinned: false, ...extra };
}

function graphOf(nodes: GraphNode[], edges: GraphEdge[], groups: GraphGroup[] = []): Graph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    nodes,
    edges,
    groups,
    node: (id) => byId.get(id),
    outgoing: (id) => edges.filter((e) => e.from === id),
    incoming: (id) => edges.filter((e) => e.to === id),
  };
}

/** Where each node ends up: its move, or where it already was. */
function placed(graph: Graph, moves: ReadonlyMap<string, { x: number; y: number }>) {
  return new Map(graph.nodes.map((n) => [n.id, { ...n.bounds, ...(moves.get(n.id) ?? {}) }]));
}

/** a feeds a group G holding b and c, and inside G a group H holding d. a
 *  leaves by its own east port; the edge into b is labeled. */
function nested(): Graph {
  return graphOf(
    [
      node('a', { ports: [{ id: 'out', at: { u: 1, v: 0.5 } }] }),
      node('b', { group: 'G' }),
      node('c', { group: 'G' }),
      node('d', { group: 'H' }),
    ],
    [
      { id: 'ab', from: 'a', to: 'b', fromPort: 'out', label: { width: 40, height: 16 } },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'cd', from: 'c', to: 'd' },
    ],
    [
      { id: 'G', members: ['b', 'c', 'd'], inset: INSET },
      { id: 'H', members: ['d'], inset: INSET, parent: 'G' },
    ],
  );
}

describe('elkPlan', () => {
  it('ranks a chain down the page, each node below the last', async () => {
    const graph = graphOf([node('a'), node('b'), node('c')], [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
    ]);
    const at = placed(graph, await elkLayout(graph, { rankGap: 50 }));
    expect(at.get('b')!.y).toBeGreaterThanOrEqual(at.get('a')!.y + 40 + 50);
    expect(at.get('c')!.y).toBeGreaterThanOrEqual(at.get('b')!.y + 40 + 50);
  });

  it('lays ranks along the direction asked for', async () => {
    const graph = graphOf([node('a'), node('b')], [{ id: 'ab', from: 'a', to: 'b' }]);
    const at = placed(graph, await elkLayout(graph, { direction: 'right' }));
    expect(at.get('b')!.x).toBeGreaterThan(at.get('a')!.x + 80);
  });

  it('starts the layout where the graph already starts', async () => {
    const graph = graphOf(
      [node('a', { bounds: { x: 500, y: 300, width: 80, height: 40 } }), node('b', { bounds: { x: 900, y: 700, width: 80, height: 40 } })],
      [{ id: 'ab', from: 'a', to: 'b' }],
    );
    const at = [...placed(graph, await elkLayout(graph)).values()];
    expect(Math.min(...at.map((b) => b.x))).toBeCloseTo(500);
    expect(Math.min(...at.map((b) => b.y))).toBeCloseTo(300);
  });

  it('keeps a pinned node where it is and lays the rest out around it', async () => {
    const graph = graphOf(
      [node('a'), node('b', { pinned: true, bounds: { x: 1000, y: 1000, width: 80, height: 40 } })],
      [{ id: 'ab', from: 'a', to: 'b' }],
    );
    const plan = await elkPlan(graph);
    expect(plan.moves.has('b')).toBe(false);
    expect(plan.moves.get('a')!.y).toBeLessThan(1000);
    expect(plan.unheld.size).toBe(0);
  });

  it('names a second pin it could not hold', async () => {
    const graph = graphOf(
      [node('a', { pinned: true }), node('b', { pinned: true })],
      [{ id: 'ab', from: 'a', to: 'b' }],
    );
    expect([...(await elkPlan(graph)).unheld]).toEqual(['b']);
  });

  it('leaves a node by the port its edge names', async () => {
    const graph = nested();
    const plan = await elkPlan(graph);
    const a = placed(graph, plan.moves).get('a')!;
    const route = plan.routes.get('ab')!;
    expect(route[0]!.x).toBeCloseTo(a.x + 80);
    expect(route[0]!.y).toBeCloseTo(a.y + 20);
    expect(plan.ports!.get('ab')!.from).toBe('out');
  });

  it('names the declared port nearest where an unnamed end meets its node', async () => {
    const graph = graphOf([node('a'), node('b')], [{ id: 'ab', from: 'a', to: 'b' }]);
    expect((await elkPlan(graph)).ports!.get('ab')).toEqual({ from: 's', to: 'n' });
  });

  it('meets the node itself where an edge names a port the node does not declare', async () => {
    const graph = graphOf([node('a'), node('b')], [{ id: 'ab', from: 'a', to: 'b', fromPort: 'gone' }]);
    expect((await elkPlan(graph)).routes.has('ab')).toBe(true);
  });

  it('boxes each group around its members, nested inside its parent, with its inset', async () => {
    const graph = nested();
    const plan = await elkPlan(graph);
    const at = placed(graph, plan.moves);
    const G = plan.groups.get('G')!;
    const H = plan.groups.get('H')!;
    for (const id of ['b', 'c']) {
      const n = at.get(id)!;
      expect(n.x).toBeGreaterThanOrEqual(G.x + INSET.left - 1e-6);
      expect(n.y).toBeGreaterThanOrEqual(G.y + INSET.top - 1e-6);
      expect(n.x + n.width).toBeLessThanOrEqual(G.x + G.width - INSET.right + 1e-6);
      expect(n.y + n.height).toBeLessThanOrEqual(G.y + G.height - INSET.bottom + 1e-6);
    }
    const d = at.get('d')!;
    expect(d.x).toBeGreaterThanOrEqual(H.x + INSET.left - 1e-6);
    expect(d.y).toBeGreaterThanOrEqual(H.y + INSET.top - 1e-6);
    expect(H.x).toBeGreaterThanOrEqual(G.x);
    expect(H.x + H.width).toBeLessThanOrEqual(G.x + G.width);
    expect(H.y + H.height).toBeLessThanOrEqual(G.y + G.height);
    expect(at.get('a')!.y + 40).toBeLessThanOrEqual(G.y);
  });

  // elkjs reads the minimum with its axes swapped when ranks run vertically.
  it.each(['down', 'up', 'right', 'left'] as const)('widens a group to its minWidth, laid out %s', async (direction) => {
    const graph = graphOf([node('b', { group: 'G' })], [], [{ id: 'G', members: ['b'], inset: INSET, minWidth: 400 }]);
    const G = (await elkPlan(graph, { direction })).groups.get('G')!;
    expect(G.width).toBeGreaterThanOrEqual(400);
    expect(G.height).toBeLessThan(400);
  });

  it('stations a label beside its route, on a point of the route', async () => {
    const graph = nested();
    const plan = await elkPlan(graph);
    const near = plan.labels!.get('ab')!;
    const route = plan.routes.get('ab')!;
    const onRoute = route.slice(1).some((p, i) => {
      const q = route[i]!;
      const cross = (p.x - q.x) * (near.y - q.y) - (p.y - q.y) * (near.x - q.x);
      const within = Math.min(q.x, p.x) - 1e-6 <= near.x && near.x <= Math.max(q.x, p.x) + 1e-6
        && Math.min(q.y, p.y) - 1e-6 <= near.y && near.y <= Math.max(q.y, p.y) + 1e-6;
      return Math.abs(cross) < 1e-6 && within;
    });
    expect(onRoute).toBe(true);
    expect(plan.labels!.has('bc')).toBe(false);
  });

  it('hands back interior waypoints only, and the whole route beside them', async () => {
    const graph = nested();
    const plan = await elkPlan(graph);
    const route = plan.routes.get('ab')!;
    const waypoints = plan.waypoints!.get('ab') ?? [];
    expect(waypoints).toEqual(route.slice(1, -1));
  });

  it('routes an edge to a group once, under the edge as drawn', async () => {
    const graph = graphOf(
      [node('a'), node('b', { group: 'G' }), node('c', { group: 'G' })],
      [
        { id: 'aG#0', from: 'a', to: 'b', toPort: 'n', origin: { id: 'aG', from: 'a', to: 'G' } },
        { id: 'aG#1', from: 'a', to: 'c', toPort: 'n', origin: { id: 'aG', from: 'a', to: 'G' } },
      ],
      [{ id: 'G', members: ['b', 'c'], inset: INSET }],
    );
    const plan = await elkPlan(graph);
    expect([...plan.routes.keys()]).toEqual(['aG']);
    const G = plan.groups.get('G')!;
    const end = plan.routes.get('aG')!.at(-1)!;
    expect(end.y).toBeCloseTo(G.y);
    expect(plan.ports!.get('aG')).toEqual({ from: 's' });
  });

  it('routes no authored edge, though it still shapes the layout', async () => {
    const graph = graphOf([node('a'), node('b')], [{ id: 'ab', from: 'a', to: 'b', authored: true }]);
    const plan = await elkPlan(graph);
    expect(plan.routes.has('ab')).toBe(false);
    const at = placed(graph, plan.moves);
    expect(at.get('b')!.y).toBeGreaterThan(at.get('a')!.y);
  });

  it('runs on the ELK instance it is handed, with the options it is handed', async () => {
    const seen: Record<string, string>[] = [];
    const elk = {
      layout: async (root: { layoutOptions?: Record<string, string>; children?: object[] }) => {
        seen.push(root.layoutOptions ?? {});
        return { ...root, children: (root.children ?? []).map((c) => ({ ...c, x: 0, y: 0 })) };
      },
    };
    const graph = graphOf([node('a')], []);
    await elkPlan(graph, { elk: elk as never, layoutOptions: { 'elk.algorithm': 'mrtree' } });
    expect(seen[0]!['elk.algorithm']).toBe('mrtree');
  });
});

describe('elkPlanner', () => {
  it('plans with its own options over the ones a run passes', async () => {
    const graph = graphOf([node('a'), node('b')], [{ id: 'ab', from: 'a', to: 'b' }]);
    const plan = await elkPlanner({ direction: 'right' }).plan(graph, { direction: 'down', nodeGap: 20 });
    expect(plan).toEqual(await elkPlan(graph, { direction: 'right', nodeGap: 20 }));
    const at = placed(graph, plan.moves);
    expect(at.get('b')!.x).toBeGreaterThan(at.get('a')!.x + 80);
  });
});
