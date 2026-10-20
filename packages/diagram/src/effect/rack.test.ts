import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import { sequenceSlots } from '../slotReorder';
import { PROBLEM_COLOR } from './draw';
import { mainChain, skipDecisions } from './mainChain';
import { rack, SIDE_PORT_GAP } from './rack';
import { ADJACENT, io, SKIP, w } from './skipFixture';
import type { EffectPipeline, EffectStage } from './types';

type Data = ReturnType<typeof rack>['data'];

/** Every edge's ends are nodes, and name ports those nodes have. */
function danglingEnds(data: Data): string[] {
  const portIds = new Map(data.nodes.map((n) => [n.id, new Set([
    ...(n.ports ?? []).map((p) => p.id),
    ...(n.rows ?? []).flatMap((r) => (r.kind === 'ports' ? [...(r.left ?? []), ...(r.right ?? [])].map((p) => p.id) : [])),
  ])]));
  return data.edges.flatMap((e) => [
    ...(portIds.get(e.from)?.has(e.fromPort ?? '') ? [] : [`${e.from}.${e.fromPort}`]),
    ...(portIds.get(e.to)?.has(e.toPort ?? '') ? [] : [`${e.to}.${e.toPort}`]),
  ]);
}

describe('rack ends', () => {
  it('draws every edge between nodes and ports that exist, for a collapsed skip', () => {
    expect(danglingEnds(rack(SKIP).data)).toEqual([]);
  });

  it('keeps two adjacent skip-ahead decisions as symbols with every edge attached', () => {
    const { data } = rack(ADJACENT);
    expect(data.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['q1', 'q2']));
    expect(danglingEnds(data)).toEqual([]);
  });
});

describe('rack', () => {
  const { data, scene } = rack(SKIP);
  const node = (id: string) => data.nodes.find((n) => n.id === id)!;
  const edge = (from: string, to: string) => data.edges.filter((e) => e.from === from && e.to === to);

  it('lays out with the chain layout, flowing right, naming the chain', () => {
    expect(scene.layout).toBe('chain');
    expect(scene.layoutOptions).toMatchObject({ direction: 'right', chain: ['src', 'blur', 'mix', 'out'], chainSide: 'after' });
  });

  it('collapses a skip-ahead decision into an arc over what it skips', () => {
    expect(data.nodes.map((n) => n.id)).toEqual(['src', 'blur', 'mix', 'out', 'osc']);
    expect(edge('src', 'blur')).toHaveLength(1);
    const [arc] = edge('src', 'mix');
    expect(arc).toMatchObject({ fromPort: '~skip-out', toPort: '~skip-in', label: 'high quality?: no' });
    expect(scene.edgeStyle!(arc!).dash).toEqual([5, 4]);
  });

  it('draws a collapsed skip in the warning color where a wire it replaces was flagged', () => {
    const withQ = (q: Partial<EffectStage>) => ({ ...SKIP, stages: SKIP.stages.map((s) => (s.id === 'q' ? { ...s, ...q } : s)) });
    const strokes = (p: EffectPipeline) => {
      expect(skipDecisions(p, mainChain(p)).map((s) => s.decision.id)).toEqual(['q']);
      const { data, scene } = rack(p);
      return ['blur', 'mix'].map((to) => scene.edgeStyle!(data.edges.find((e) => e.from === 'src' && e.to === to)!).stroke);
    };
    const skipFlagged = withQ({ outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'mask' }] });
    expect(strokes(skipFlagged).map((c) => c === PROBLEM_COLOR)).toEqual([false, true]);
    const throughFlagged = withQ({ outputs: [{ id: 'yes', type: 'mask' }, { id: 'no', type: 'image' }] });
    expect(strokes(throughFlagged).map((c) => c === PROBLEM_COLOR)).toEqual([true, false]);
    const intoFlagged = withQ({ inputs: [{ id: 'in', type: 'mask' }] });
    expect(strokes(intoFlagged).map((c) => c === PROBLEM_COLOR)).toEqual([true, true]);
  });

  it('keeps the decision as its symbol when told not to collapse', () => {
    const kept = rack(SKIP, { collapseSkips: false });
    expect(kept.data.nodes.map((n) => n.id)).toContain('q');
    expect(kept.scene.layoutOptions?.chain).toEqual(['src', 'q', 'blur', 'mix', 'out']);
  });

  it('puts the main signal on a stage\'s left and right, and a side input underneath', () => {
    const ports = Object.fromEntries(node('blur').ports!.map((p) => [p.id, p.at]));
    expect(ports.in).toEqual({ u: 0, v: 0.5 });
    expect(ports.out).toEqual({ u: 1, v: 0.5 });
    expect(ports.radius!.v).toBe(1);
    expect(node('blur').ports!.find((p) => p.id === 'radius')!.normal).toEqual({ x: 0, y: 1 });
  });

  it('labels a wire into a side input with the input\'s name', () => {
    expect(edge('osc', 'blur')[0]).toMatchObject({ fromPort: 'value', toPort: 'radius', label: 'radius' });
  });

  it('turns a side stage\'s output toward the line', () => {
    expect(node('osc').ports!.find((p) => p.id === 'value')!.at.v).toBe(0);
  });

  it('flips everything for side: above', () => {
    const above = rack(SKIP, { side: 'above' });
    expect(above.scene.layoutOptions?.chainSide).toBe('before');
    expect(above.data.nodes.find((n) => n.id === 'blur')!.ports!.find((p) => p.id === 'radius')!.at.v).toBe(0);
    expect(above.data.nodes.find((n) => n.id === 'osc')!.ports!.find((p) => p.id === 'value')!.at.v).toBe(1);
  });

  it('uses the chain it is given', () => {
    expect(rack(SKIP, { chain: ['osc', 'blur'], collapseSkips: false }).scene.layoutOptions?.chain).toEqual(['osc', 'blur']);
  });

  it('drops a collapsed decision from any group that named it', () => {
    const grouped = rack({ ...SKIP, groups: [{ id: 'g', members: ['q', 'blur'] }] });
    expect(grouped.data.groups).toEqual([{ id: 'g', members: ['blur'] }]);
  });

  it('keeps the first of two groups sharing an id, and drops a group named like a stage', () => {
    const twice = rack({ ...SKIP, groups: [{ id: 'g', members: ['q', 'blur'] }, { id: 'g', members: ['mix'] }, { id: 'mix', members: ['osc'] }] });
    expect(twice.data.groups).toEqual([{ id: 'g', members: ['blur'] }]);
    expect(() => diagramScene(twice.data, twice.scene)).not.toThrow();
  });

  it('turns a decision\'s control input toward the side its driver hangs on', () => {
    const gated: EffectPipeline = {
      ...SKIP,
      stages: SKIP.stages.map((s) => (s.id === 'q' ? { ...s, inputs: [...s.inputs!, { id: 'when', type: 'number' }] } : s)),
      wires: [...SKIP.wires, w(['osc', 'value'], ['q', 'when'])],
    };
    const when = (side: 'below' | 'above') => rack(gated, { collapseSkips: false, branch: 'switch', side })
      .data.nodes.find((n) => n.id === 'q')!.ports!.find((p) => p.id === 'when')!.at.v;
    expect(when('below')).toBe(1);
    expect(when('above')).toBe(0);
  });

  it('widens a stage so its side ports sit apart, however many there are', () => {
    const knobs = Array.from({ length: 8 }, (_, i) => `k${i}`);
    const many: EffectPipeline = {
      types: { number: { control: true } },
      stages: [
        io('src', { inputs: [] }),
        io('fx', { inputs: [{ id: 'in', type: 'image' }, ...knobs.map((k) => ({ id: k, type: 'number' }))] }),
        io('out', { outputs: [] }),
        ...knobs.map((k) => ({ id: `osc-${k}`, title: 'o', outputs: [{ id: 'value', type: 'number' }] })),
      ],
      wires: [w(['src', 'out'], ['fx', 'in']), w(['fx', 'out'], ['out', 'in']), ...knobs.map((k) => w([`osc-${k}`, 'value'], ['fx', k]))],
    };
    const drawn = rack(many);
    const specs = diagramScene(drawn.data, drawn.scene);
    const width = (specs.find((s) => s.id === 'fx')!.pose as { width: number }).width;
    const us = drawn.data.nodes.find((n) => n.id === 'fx')!.ports!.filter((p) => knobs.includes(p.id)).map((p) => p.at.u).sort();
    const gaps = us.slice(1).map((u, i) => (u - us[i]!) * width);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(SIDE_PORT_GAP - 1e-9);
    expect(us[0]! * width).toBeGreaterThanOrEqual(SIDE_PORT_GAP - 1e-9);
  });

  it('builds a scene diagramScene accepts, and an empty one for an empty pipeline', () => {
    expect(() => diagramScene(data, scene)).not.toThrow();
    const empty = rack({ stages: [], wires: [] });
    expect(empty.data).toEqual({ nodes: [], edges: [], groups: [] });
    expect(diagramScene(empty.data, empty.scene)).toEqual([]);
  });
});

describe('rack order', () => {
  it('names the stages on the line, in order, as the sequence a reorder drags along', () => {
    expect(rack(SKIP).order).toEqual({ axis: 'x', items: ['src', 'blur', 'mix', 'out'].map((id) => ({ id })) });
  });

  it('puts each gap between the drawn boxes of its neighbors', () => {
    const drawn = rack(SKIP);
    const specs = diagramScene(drawn.data, drawn.scene);
    type Box = { x: number; y: number; width: number; height: number };
    const items = drawn.order!.items.map(({ id }) => ({ id, bounds: specs.find((s) => s.id === id)!.pose as Box }));
    const { gaps } = sequenceSlots('x', items);
    for (let k = 1; k < items.length; k++) {
      const [a, b] = [items[k - 1]!.bounds, items[k]!.bounds];
      expect(gaps[k]!.a.x).toBeGreaterThan(a.x + a.width);
      expect(gaps[k]!.a.x).toBeLessThan(b.x);
    }
  });
});
