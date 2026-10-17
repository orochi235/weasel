import { describe, expect, it } from 'vitest';
import { nodeGraph } from '../effect/nodeGraph';
import { SAMPLES } from '../effect/lab/samples';
import { expandGroupEdges, insetOf } from '../cluster';
import { diagramScene } from '../fromData';
import type { Graph, GraphGroup, GraphNode } from '../graph';
import { layered, layeredPlan, type LayeredPlan } from '../layered';
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

/** `group`'s box in `graph`: its members' union, grown by its inset. */
function boxOf(graph: Graph, group: GraphGroup): GraphNode['bounds'] {
  const ms = group.members.map((m) => graph.node(m)!.bounds);
  const x = Math.min(...ms.map((b) => b.x)) - group.inset.left;
  const y = Math.min(...ms.map((b) => b.y)) - group.inset.top;
  return {
    x,
    y,
    width: Math.max(...ms.map((b) => b.x + b.width)) + group.inset.right - x,
    height: Math.max(...ms.map((b) => b.y + b.height)) + group.inset.bottom - y,
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

/** `graph` once `plan` is written: its nodes moved, and every edge on the
 *  route the plan gave it, as `applyLayout` leaves a scene. */
function routed(graph: Graph, plan: LayeredPlan): Graph {
  const moved = after(graph, plan.moves);
  const edges = graph.edges.map((e) => {
    const { waypoints: _, ...rest } = e;
    const route = plan.waypoints.get(e.origin?.id ?? e.id);
    return route === undefined ? rest : { ...rest, waypoints: route };
  });
  return { ...moved, edges };
}

const overlap = (a: GraphNode['bounds'], b: GraphNode['bounds']) =>
  a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6;

/** Whether the segment from `a` to `b`, axis-aligned or not, enters `box`. */
function segmentHits(a: { x: number; y: number }, b: { x: number; y: number }, box: GraphNode['bounds']): boolean {
  let lo = 0;
  let hi = 1;
  for (const [p, d, min, max] of [[a.x, b.x - a.x, box.x, box.x + box.width], [a.y, b.y - a.y, box.y, box.y + box.height]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p <= min + 1e-6 || p >= max - 1e-6) return false;
      continue;
    }
    const t0 = (min - p) / d;
    const t1 = (max - p) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
  }
  return hi - lo > 1e-6;
}

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const MODES: LayoutOptions[] = [{ order: 'seeded' }, { order: 'barycenter' }, { order: 'barycenter', direction: 'right' }];
const DIRECTIONS = ['down', 'right', 'up', 'left'] as const;

/** Seed `seed`'s graph laid out, then with `n0` and one other node pinned
 *  and that other one dragged up to 150 either way along each axis. */
function draggedPin(seed: number, opts: LayoutOptions, grouped = false): { dragged: Graph; pins: string[] } {
  const rand = lcg(seed * 7919);
  const graph = generated(seed, grouped);
  const laid = routed(graph, layeredPlan(graph, opts));
  const ids = laid.nodes.map((n) => n.id);
  const pins = ['n0', ids[2 + Math.floor(rand() * (ids.length - 2))]!];
  const from = laid.node(pins[1]!)!.bounds;
  const dragged = after(laid, new Map([[pins[1]!, { x: from.x + (rand() - 0.5) * 300, y: from.y + (rand() - 0.5) * 300 }]]));
  return { dragged, pins };
}

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
          const box = boxOf(graph, g);
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
      const plan = layeredPlan(generated(seed, grouped));
      const again = layeredPlan(routed(generated(seed, grouped), plan));
      expect(again.moves.size).toBe(0);
      expect(again.waypoints).toEqual(plan.waypoints);
    }
  });

  it.each(SEEDS)('seed %i: a pinned node stays put', (seed) => {
    const graph = generated(seed, false);
    const result = layered(graph, { order: 'barycenter', pin: ['n2'] });
    expect(result.has('n2')).toBe(false);
  });

  it.each(SEEDS)('seed %i: with a second pin dragged, a re-run builds around both pins and then moves nothing', (seed) => {
    for (const direction of DIRECTIONS) {
      for (const grouped of [false, true]) {
        const { dragged, pins } = draggedPin(seed, { direction }, grouped);
        const plan = layeredPlan(dragged, { direction, pin: pins });
        if (plan.unheld.size > 0) continue;
        const next = routed(dragged, plan);
        expectClearOf(next, pins);
        expect(layeredPlan(next, { direction, pin: pins }).moves.size, `${direction}${grouped ? ', grouped' : ''}`).toBe(0);
      }
    }
  });

  it('holds most dragged pins, and says which it cannot', () => {
    let held = 0;
    for (const seed of SEEDS) {
      for (const direction of DIRECTIONS) {
        const { dragged, pins } = draggedPin(seed, { direction });
        const { unheld } = layeredPlan(dragged, { direction, pin: pins });
        expect([...unheld].every((id) => id === pins[1])).toBe(true);
        if (unheld.size === 0) held++;
      }
    }
    // The six left each sit within a quarter of rankGap of the anchor's rank.
    expect(held).toBeGreaterThanOrEqual(154);
  });

  it.each(SEEDS)('seed %i: holding a dragged pin puts nothing in a group\'s box that is not in the group', (seed) => {
    for (const direction of DIRECTIONS) {
      const { dragged, pins } = draggedPin(seed, { direction }, true);
      const plan = layeredPlan(dragged, { direction, pin: pins });
      if (plan.unheld.size > 0) continue;
      const next = after(dragged, plan.moves);
      for (const g of next.groups ?? []) {
        const box = boxOf(next, g);
        for (const n of next.nodes) {
          if (!g.members.includes(n.id)) expect(overlap(n.bounds, box), `${direction}: ${n.id} in ${g.id}`).toBe(false);
        }
      }
    }
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

describe('layered, with two pins', () => {
  /** a → b → c, with a long edge a → c beside b, laid out down, and c then
   *  moved by `dy` and pinned with a. */
  function chain(dy: number): { graph: Graph; plan: LayeredPlan } {
    const box = (x: number, y: number) => ({ x, y, width: 80, height: 30 });
    const nodes: GraphNode[] = [
      { id: 'a', bounds: box(0, 0), pinned: true },
      { id: 'b', bounds: box(0, 126), pinned: false },
      { id: 'c', bounds: box(0, 252 + dy), pinned: true },
    ];
    const edges = [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'ac', from: 'a', to: 'c' },
    ];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const graph: Graph = {
      nodes,
      edges,
      node: (id) => byId.get(id),
      outgoing: (id) => edges.filter((e) => e.from === id),
      incoming: (id) => edges.filter((e) => e.to === id),
    };
    return { graph, plan: layeredPlan(graph) };
  }

  it('stretches the gap before a pin moved away from the first, keeping its rank clear of the one before', () => {
    const { graph, plan } = chain(200);
    expect(plan.unheld.size).toBe(0);
    const b = after(graph, plan.moves).node('b')!.bounds;
    expect(b.y + b.height).toBeLessThan(452);
    expect(plan.waypoints.get('ac')!.every((p) => p.y < 452)).toBe(true);
  });

  it('shrinks the gap before a pin moved toward the first', () => {
    const { plan } = chain(-50);
    expect(plan.unheld.size).toBe(0);
    expect(plan.waypoints.get('ac')!.every((p) => p.y < 202)).toBe(true);
  });

  it('shrinks every gap between a pin and the first to reach it, moving the rank between', () => {
    const { graph, plan } = chain(-100);
    expect(plan.unheld.size).toBe(0);
    const b = after(graph, plan.moves).node('b')!.bounds;
    expect(b.y).toBeGreaterThanOrEqual(30 + 24 - 1e-6);
    expect(b.y + b.height).toBeLessThanOrEqual(152 - 24 + 1e-6);
  });

  it('cannot hold a pin that would shrink the gaps toward the first below a quarter of rankGap, and says so', () => {
    expect([...chain(-160).plan.unheld]).toEqual(['c']);
  });
});

/** No node on any pin in `graph`, and no route through one it does not join. */
function expectClearOf(graph: Graph, pins: readonly string[]): void {
  for (const pin of pins) {
    const box = graph.node(pin)!.bounds;
    for (const n of graph.nodes) if (n.id !== pin) expect(overlap(n.bounds, box), `${n.id} on ${pin}`).toBe(false);
    for (const e of graph.edges) {
      if (e.from === pin || e.to === pin) continue;
      const route = e.waypoints ?? [];
      for (let i = 1; i < route.length; i++) {
        expect(segmentHits(route[i - 1]!, route[i]!, box), `${e.id} through ${pin}`).toBe(false);
      }
    }
  }
}

describe('layered, with two pins in one rank', () => {
  /** r above a, b and c, laid out down, with a and c pinned and c then moved
   *  to `c`. */
  function fan(c: { x: number; y: number }): { graph: Graph; plan: LayeredPlan } {
    const box = (x: number, y: number) => ({ x, y, width: 80, height: 30 });
    const nodes: GraphNode[] = [
      { id: 'r', bounds: box(128, 0), pinned: false },
      { id: 'a', bounds: box(0, 126), pinned: true },
      { id: 'b', bounds: box(128, 126), pinned: false },
      { id: 'c', bounds: box(c.x, c.y), pinned: true },
    ];
    const edges = ['a', 'b', 'c'].map((to) => ({ id: `r${to}`, from: 'r', to }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const graph: Graph = {
      nodes,
      edges,
      node: (id) => byId.get(id),
      outgoing: (id) => edges.filter((e) => e.from === id),
      incoming: (id) => edges.filter((e) => e.to === id),
    };
    return { graph, plan: layeredPlan(graph) };
  }

  it('deepens the rank\'s band to reach a pin at another depth from the first', () => {
    const { graph, plan } = fan({ x: 256, y: 186 });
    expect(plan.unheld.size).toBe(0);
    const next = after(graph, plan.moves);
    expectClearOf(next, ['a', 'c']);
    expect(layeredPlan(routed(graph, plan)).moves.size).toBe(0);
  });

  it('moves a node past a pin when the two pins beside it leave it too little room', () => {
    const { graph, plan } = fan({ x: 100, y: 126 });
    expect(plan.unheld.size).toBe(0);
    expectClearOf(after(graph, plan.moves), ['a', 'c']);
  });
});

describe('layered, with pins that move the anchor\'s band or a group', () => {
  function graphOf(nodes: GraphNode[], pairs: [string, string][], groups: GraphGroup[] = []): Graph {
    const edges = expandGroupEdges(pairs.map(([from, to]) => ({ id: `${from}${to}`, from, to })), groups);
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

  it('slides the anchor\'s band away from a pin when the anchor is not its rank\'s deepest node', () => {
    const graph = graphOf(
      [
        { id: 'a', bounds: { x: 0, y: 15, width: 80, height: 30 }, pinned: true },
        { id: 't', bounds: { x: 128, y: 0, width: 80, height: 60 }, pinned: false },
        { id: 'c', bounds: { x: 0, y: 74, width: 80, height: 30 }, pinned: true },
      ],
      [['a', 'c'], ['t', 'c']],
    );
    const plan = layeredPlan(graph);
    expect(plan.unheld.size).toBe(0);
    const t = after(graph, plan.moves).node('t')!.bounds;
    expect(t.y + t.height).toBeLessThanOrEqual(74 - 24 + 1e-6);
    expect(t.y).toBeLessThanOrEqual(15 + 1e-6);
  });

  it('widens a group\'s column to hold two of its members pinned apart, keeping outsiders out of its box', () => {
    const box = (x: number) => ({ x, y: 0, width: 80, height: 30 });
    const groups: GraphGroup[] = [{ id: 'G', members: ['m1', 'm2'], inset: insetOf(12) }];
    const nodes: GraphNode[] = [
      { id: 'r', bounds: box(0), pinned: false },
      { id: 'm1', bounds: box(0), pinned: false, group: 'G' },
      { id: 'm2', bounds: box(0), pinned: false, group: 'G' },
      { id: 'o', bounds: box(0), pinned: false },
    ];
    const graph = graphOf(nodes, [['r', 'm1'], ['r', 'm2'], ['r', 'o'], ['m1', 'm2']], groups);
    const laid = routed(graph, layeredPlan(graph));
    const m2 = laid.node('m2')!.bounds;
    const dragged = after(laid, new Map([['m2', { x: m2.x + 400, y: m2.y }]]));
    const plan = layeredPlan(dragged, { pin: ['m1', 'm2'] });
    expect(plan.unheld.size).toBe(0);
    const next = after(dragged, plan.moves);
    const g = boxOf(next, groups[0]!);
    for (const id of ['r', 'o']) expect(overlap(next.node(id)!.bounds, g), id).toBe(false);
    expectClearOf(next, ['m1', 'm2']);
  });
});
