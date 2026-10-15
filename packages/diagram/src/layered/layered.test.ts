import { describe, expect, it } from 'vitest';
import { nodeGraph } from '../effect/nodeGraph';
import { SAMPLES } from '../effect/lab/samples';
import { expandGroupEdges, insetOf } from '../cluster';
import { diagramScene } from '../fromData';
import type { Graph, GraphGroup, GraphNode } from '../graph';
import { layered, layeredPlan } from '../layered';
import type { LayoutOptions, LayoutResult } from '../layout';
import { ANCHORS } from './fixtures';
import { crossingPairs, labelsInTheWay, wiresThroughBoxes } from './overlaps';

/** Crossings each fixture draws, counting wires that cross on their way into
 *  one node's different ports; none may get worse. Before ordering and
 *  placement read ports, sideInputs drew 2, skip 6 and broken 2. anchors'
 *  one cannot go: `voice:intro` feeds both joins and sits left of the query
 *  feeding the left one. */
const CROSSINGS_BEFORE: Record<string, number> = {
  anchors: 1, chain: 0, branch: 0, sideInputs: 0, skip: 0, bands: 0, large: 0, broken: 1,
};

describe('layered, measured through diagramScene', () => {
  const cases: [string, ReturnType<typeof diagramScene>, Parameters<typeof wiresThroughBoxes>[0]][] = [];
  const anchorSpecs = diagramScene(ANCHORS, { layoutOptions: { direction: 'down', order: 'barycenter', nodeGap: 40, rankGap: 56 } });
  cases.push(['anchors', anchorSpecs, ANCHORS]);
  for (const [name, pipeline] of Object.entries(SAMPLES)) {
    const drawn = nodeGraph(pipeline);
    cases.push([name, diagramScene(drawn.data, drawn.scene), drawn.data]);
  }

  it.each(cases)('%s: no wire runs through a box it does not join', (_, specs, data) => {
    expect(wiresThroughBoxes(data, specs)).toEqual([]);
  });

  it.each(cases)('%s: no more crossings than before', (name, specs) => {
    expect(crossingPairs(specs)).toBeLessThanOrEqual(CROSSINGS_BEFORE[name]!);
  });

  it.each(['down', 'right', 'up', 'left'] as const)('anchors, laid out %s: no label sits on a box or under another wire', (direction) => {
    const specs = diagramScene(ANCHORS, { layoutOptions: { direction, order: 'barycenter', nodeGap: 40, rankGap: 56 } });
    expect(labelsInTheWay(ANCHORS, specs)).toEqual([]);
    expect(wiresThroughBoxes(ANCHORS, specs)).toEqual([]);
  });
});

describe('layered inside a group', () => {
  it('keeps a labeled wire between two members straight through its label room', () => {
    const data = {
      nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, lines: [id] })),
      edges: [{ from: 'a', to: 'g' }, { from: 'b', to: 'c', label: 'inside' }, { from: 'g', to: 'd' }],
      groups: [{ id: 'g', members: ['b', 'c'] }],
    };
    const specs = diagramScene(data, { layoutOptions: { direction: 'down', nodeGap: 40, rankGap: 56 } });
    const center = (id: string) => { const p = specs.find((s) => s.id === id)!.pose; return p.x + p.width / 2; };
    const wire = specs.find((s) => s.id === 'edge:b->c:inside')!.data!.diagram as { waypoints?: readonly { x: number }[] };
    expect(center('b')).toBeCloseTo(center('c'), 6);
    expect(wire.waypoints?.map((p) => p.x)).toEqual([center('b'), center('b')]);
    expect(labelsInTheWay(data, specs)).toEqual([]);
  });
});

describe('layeredPlan', () => {
  it('settles a grouped seeded layout the way layered does', () => {
    // `mid` starts between the group's members and has to leave, which
    // changes the order a second pass reads.
    const graph = generatedFrom(
      ['in', 'a0', 'mid', 'a1', 'z'],
      [['in', 'a0'], ['in', 'mid'], ['in', 'a1'], ['a0', 'z'], ['mid', 'z'], ['a1', 'z']],
      { A: ['a0', 'a1'] },
    );
    expect(layeredPlan(graph).moves).toEqual(layered(graph));
    expect(layered(after(graph, layeredPlan(graph).moves)).size).toBe(0);
  });

  it('does not count a self-loop as turned around', () => {
    const graph = generatedFrom(['a', 'b'], [['a', 'a'], ['a', 'b']], {});
    expect([...layeredPlan(graph).back]).toEqual([]);
    expect(layeredPlan(graph).ranks.get('a')).toBe(0);
  });
});

function generatedFrom(ids: string[], pairs: [string, string][], groups: Record<string, string[]>): Graph {
  const nodes: GraphNode[] = ids.map((id, i) => ({ id, bounds: { x: i * 120, y: 0, width: 80, height: 30 }, pinned: false }));
  const gs: GraphGroup[] = Object.entries(groups).map(([id, members]) => ({ id, members, inset: insetOf(12) }));
  for (const g of gs) for (const m of g.members) nodes.find((n) => n.id === m)!.group = g.id;
  const edges = expandGroupEdges(pairs.map(([from, to], i) => ({ id: `e${i}`, from, to })), gs);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    nodes,
    edges,
    groups: gs,
    node: (id) => byId.get(id),
    outgoing: (id) => edges.filter((e) => e.from === id),
    incoming: (id) => edges.filter((e) => e.to === id),
  };
}

/** A small deterministic generator, so a failure names a seed that replays. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function generated(seed: number, grouped: boolean): Graph {
  const rand = lcg(seed);
  const count = 6 + Math.floor(rand() * 14);
  const nodes: GraphNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({ id: `n${i}`, bounds: { x: rand() * 600, y: rand() * 600, width: 30 + rand() * 60, height: 20 + rand() * 30 }, pinned: false });
  }
  const pairs: { id: string; from: string; to: string }[] = [];
  for (let i = 1; i < count; i++) {
    const links = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < links; k++) {
      const j = Math.floor(rand() * i);
      pairs.push({ id: `e${pairs.length}`, from: `n${j}`, to: `n${i}` });
    }
  }
  if (rand() < 0.5) pairs.push({ id: `e${pairs.length}`, from: `n${count - 1}`, to: 'n0' });
  const groups: GraphGroup[] = [];
  if (grouped && count >= 6) {
    const start = 1 + Math.floor(rand() * (count - 4));
    const members = [`n${start}`, `n${start + 1}`, `n${start + 2}`];
    groups.push({ id: 'G', members, inset: insetOf(12) });
    for (const m of members) nodes.find((n) => n.id === m)!.group = 'G';
  }
  const edges = expandGroupEdges(pairs, groups);
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

function after(graph: Graph, result: LayoutResult): Graph {
  const nodes = graph.nodes.map((n) => {
    const to = result.get(n.id);
    return to === undefined ? n : { ...n, bounds: { ...n.bounds, x: to.x, y: to.y } };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return { ...graph, nodes, node: (id) => byId.get(id) };
}

const overlap = (a: GraphNode['bounds'], b: GraphNode['bounds']) =>
  a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6;

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const MODES: LayoutOptions[] = [{ order: 'seeded' }, { order: 'barycenter' }, { order: 'barycenter', direction: 'right' }];

describe('layered, over generated graphs', () => {
  it.each(SEEDS)('seed %i: no two nodes overlap, and nothing enters a group\'s box', (seed) => {
    for (const opts of MODES) {
      for (const grouped of [false, true]) {
        const graph = after(generated(seed, grouped), layered(generated(seed, grouped), opts));
        for (let i = 0; i < graph.nodes.length; i++) {
          for (let j = i + 1; j < graph.nodes.length; j++) {
            expect(overlap(graph.nodes[i]!.bounds, graph.nodes[j]!.bounds), `${graph.nodes[i]!.id} / ${graph.nodes[j]!.id}`).toBe(false);
          }
        }
        for (const g of graph.groups ?? []) {
          const ms = g.members.map((m) => graph.node(m)!.bounds);
          const box = {
            x: Math.min(...ms.map((b) => b.x)) - g.inset.left,
            y: Math.min(...ms.map((b) => b.y)) - g.inset.top,
            width: 0,
            height: 0,
          };
          box.width = Math.max(...ms.map((b) => b.x + b.width)) + g.inset.right - box.x;
          box.height = Math.max(...ms.map((b) => b.y + b.height)) + g.inset.bottom - box.y;
          for (const n of graph.nodes) {
            if (!g.members.includes(n.id)) expect(overlap(n.bounds, box), `${n.id} in ${g.id}`).toBe(false);
          }
        }
      }
    }
  });

  it.each(SEEDS)('seed %i: the same input lays out the same, and a seeded re-run moves nothing', (seed) => {
    for (const opts of MODES) {
      expect(layered(generated(seed, true), opts)).toEqual(layered(generated(seed, true), opts));
    }
    for (const grouped of [false, true]) {
      const once = after(generated(seed, grouped), layered(generated(seed, grouped)));
      expect(layered(once).size).toBe(0);
    }
  });

  it.each(SEEDS)('seed %i: a pinned node stays put', (seed) => {
    const graph = generated(seed, false);
    const result = layered(graph, { order: 'barycenter', pin: ['n2'] });
    expect(result.has('n2')).toBe(false);
  });

  it.each(SEEDS)('seed %i: every forward edge spanning ranks has two waypoints per rank it crosses', (seed) => {
    const graph = generated(seed, false);
    const plan = layeredPlan(graph, { order: 'barycenter' });
    for (const e of graph.edges) {
      const span = Math.abs(plan.ranks.get(e.to)! - plan.ranks.get(e.from)!);
      expect(plan.waypoints.get(e.id)?.length ?? 0).toBe(span > 1 ? 2 * (span - 1) : 0);
    }
  });
});
