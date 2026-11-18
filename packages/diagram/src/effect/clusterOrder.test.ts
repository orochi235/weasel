import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import { contains } from '../clusterFixture';
import type { LookOrder } from './draw';
import { editorScene } from './editorMapping';
import { clusterLabelIdOf } from '../dataClusters';
import { clusterMove, stageMove, type ReorderSource } from './editorReorder';
import { clusterAt, clusterGripOf, clusterRuns, clusterSlotsAt } from './clusterOrder';
import { mainChain } from './mainChain';
import { io, SKIP, w } from './skipFixture';
import type { EffectDoc, EffectCluster, EffectPipeline } from './types';
import type { Rect } from '@weasel-js/geom';

const CHAIN: readonly string[] = ['src', 'a', 'b', 'c', 'd', 'out'];
const PIPELINE: EffectPipeline = {
  stages: [io('src', { inputs: [] }), io('a'), io('b'), io('c'), io('d'), io('out', { outputs: [] }), io('side', { inputs: [] })],
  wires: CHAIN.slice(1).map((id, k) => w([CHAIN[k]!, 'out'], [id, 'in'])),
};
const withClusters = (clusters: EffectCluster[]): EffectPipeline => ({ ...PIPELINE, clusters });
const docOf = (clusters: EffectCluster[]): EffectDoc => ({ pipeline: withClusters(clusters), places: {} });
const ORDER: LookOrder = { axis: 'x', items: CHAIN.map((id) => ({ id })) };
const move = (doc: EffectDoc, id: string, to: number) => stageMove(doc, ORDER, { id, from: CHAIN.indexOf(id), to, order: [] });

describe('clusterRuns', () => {
  it('gives each cluster the chain indices its members span', () => {
    const runs = clusterRuns(withClusters([{ id: 'g', members: ['b', 'c', 'side'] }]), CHAIN);
    expect(runs.get('g')).toEqual({ first: 2, last: 3 });
  });

  it('gives a split cluster no run', () => {
    expect(clusterRuns(withClusters([{ id: 'g', members: ['a', 'c'] }]), CHAIN).get('g')).toBeNull();
  });

  it('counts members through nested clusters', () => {
    const runs = clusterRuns(withClusters([{ id: 'g', members: ['a', 'b'] }, { id: 'h', members: ['g', 'c'] }]), CHAIN);
    expect(runs.get('h')).toEqual({ first: 1, last: 3 });
    expect(runs.get('g')).toEqual({ first: 1, last: 2 });
  });

  it('leaves out a cluster with no stage on the chain', () => {
    expect(clusterRuns(withClusters([{ id: 'g', members: ['side'] }]), CHAIN).has('g')).toBe(false);
  });
});

describe('stageMove with clusters', () => {
  it('refuses a stage dropped into the middle of a cluster', () => {
    expect(move(docOf([{ id: 'g', members: ['a', 'b'] }]), 'c', 2)).toBeNull();
  });

  it('refuses a member dragged out of its own cluster', () => {
    expect(move(docOf([{ id: 'g', members: ['a', 'b'] }]), 'a', 5)).toBeNull();
  });

  it('refuses a drop that splits only an outer cluster', () => {
    expect(move(docOf([{ id: 'g', members: ['a', 'b'] }, { id: 'h', members: ['g', 'c'] }]), 'd', 3)).toBeNull();
  });

  it('allows a drop that keeps every cluster whole', () => {
    const next = move(docOf([{ id: 'g', members: ['a', 'b'] }]), 'd', 1)!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'd', 'a', 'b', 'c', 'out']);
  });

  it('still allows a drop when the cluster was already split', () => {
    const next = move(docOf([{ id: 'g', members: ['a', 'c'] }]), 'd', 1)!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'd', 'a', 'b', 'c', 'out']);
  });

  it('draws a split cluster around the stage between its members under rack', () => {
    const { data, scene } = editorScene(docOf([{ id: 'g', members: ['a', 'c'] }]), 'rack');
    const specs = diagramScene(data, scene);
    const pose = (id: string) => specs.find((s) => s.id === id)!.pose as Rect;
    expect(contains(pose('g'), pose('b'))).toBe(true);
  });
});

/** What a press reads under rack, as drawn. */
function rackSource(doc: EffectDoc): ReorderSource {
  const built = editorScene(doc, 'rack');
  const boxes = new Map(diagramScene(built.data, built.scene).map((s) => [s.id as string, s.pose as Rect]));
  return { doc, order: built.order, laneOrder: built.laneOrder, boxOf: (id) => boxes.get(id), onChange: () => {} };
}
const middle = (b: Rect) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const NESTED: EffectCluster[] = [{ id: 'g', label: 'Inner', members: ['a', 'b'] }, { id: 'h', label: 'Outer', members: ['g', 'c'] }];

describe('clusterGripOf', () => {
  it('is the band from the top of the box to the top of its highest member', () => {
    const source = rackSource(docOf(NESTED));
    const box = source.boxOf('g')!;
    const grip = clusterGripOf(source.doc, 'g', source.boxOf)!;
    expect(grip).toEqual({ x: box.x, y: box.y, width: box.width, height: Math.min(source.boxOf('a')!.y, source.boxOf('b')!.y) - box.y });
    expect(contains(grip, source.boxOf(clusterLabelIdOf('g'))!)).toBe(true);
  });
});

describe('clusterAt', () => {
  it('answers over clusters that hold each other in a loop', () => {
    const doc = docOf([{ id: 'A', members: ['B'] }, { id: 'B', members: ['A'] }, { id: 'C', members: ['s'] }]);
    const tops: Record<string, number> = { A: 0, B: 10, C: 0, s: 10 };
    const boxOf = (id: string) => (Object.hasOwn(tops, id) ? { x: 0, y: tops[id]!, width: 100, height: 100 } : undefined);
    expect(['A', 'C']).toContain(clusterAt(doc, boxOf, { x: 5, y: 5 }));
  });
});

describe('clusterSlotsAt', () => {
  it('picks the innermost cluster whose title holds the press', () => {
    const source = rackSource(docOf(NESTED));
    const slots = clusterSlotsAt(source, middle(source.boxOf(clusterLabelIdOf('g'))!))!;
    expect(slots.items.map((i) => i.id)).toEqual(['g', 'c']);
    expect(slots.items[0]!.grip).toEqual(clusterGripOf(source.doc, 'g', source.boxOf));
    expect([...slots.items[0]!.carries!].sort()).toEqual(['a', 'b', 'g', clusterLabelIdOf('g')].sort());
    expect(slots.items[1]!.grip).toBeNull();
  });

  it('gives an outer cluster the top level as its siblings, carrying the clusters inside it', () => {
    const source = rackSource(docOf(NESTED));
    const slots = clusterSlotsAt(source, middle(source.boxOf(clusterLabelIdOf('h'))!))!;
    expect(slots.items.map((i) => i.id)).toEqual(['src', 'h', 'd', 'out']);
    expect([...slots.items[1]!.carries!].sort()).toEqual(['a', 'b', 'c', 'g', 'h', clusterLabelIdOf('g'), clusterLabelIdOf('h')].sort());
  });

  it('has no slots on a cluster with no stage on the line', () => {
    const source = rackSource(docOf([{ id: 's', label: 'Side', members: ['side'] }]));
    expect(source.boxOf(clusterLabelIdOf('s'))).toBeDefined();
    expect(clusterSlotsAt(source, middle(source.boxOf(clusterLabelIdOf('s'))!))).toBeNull();
  });

  it('has no slots on a split cluster, and does not throw', () => {
    const source = rackSource(docOf([{ id: 'g', label: 'Split', members: ['a', 'c'] }]));
    expect(clusterSlotsAt(source, middle(source.boxOf(clusterLabelIdOf('g'))!))).toBeNull();
  });

  it('has no slots off every title', () => {
    const source = rackSource(docOf(NESTED));
    expect(clusterSlotsAt(source, middle(source.boxOf('a')!))).toBeNull();
  });
});

describe('clusterMove', () => {
  it('moves a cluster past the next unit', () => {
    const doc = docOf([{ id: 'g', members: ['a', 'b'] }]);
    const units = ['src', 'g', 'c', 'd', 'out'];
    const next = clusterMove(doc, ORDER, units, { id: 'g', from: 1, to: 3, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'd', 'out']);
  });

  it('moves a cluster among its parent’s members, keeping the parent whole', () => {
    const next = clusterMove(docOf(NESTED), ORDER, ['g', 'c'], { id: 'g', from: 0, to: 2, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'd', 'out']);
    expect(clusterRuns(next.pipeline, mainChain(next.pipeline)).get('h')).toEqual({ first: 1, last: 3 });
  });

  it('moves a stage among a cluster’s members', () => {
    const next = clusterMove(docOf(NESTED), ORDER, ['g', 'c'], { id: 'c', from: 1, to: 0, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'd', 'out']);
  });

  it('refuses a split cluster', () => {
    const units = ['src', 'g', 'b', 'd', 'out'];
    expect(clusterMove(docOf([{ id: 'g', members: ['a', 'c'] }]), ORDER, units, { id: 'g', from: 1, to: 3, order: [] })).toBeNull();
  });
});

/** SKIP with a stage `e` between mix and out: src, q, blur, mix, e, out, where rack draws q as an arc. */
const SKIP_E: EffectPipeline = {
  ...SKIP,
  stages: [...SKIP.stages, io('e')],
  wires: [...SKIP.wires.filter((x) => x.from.stage !== 'mix'), w(['mix', 'out'], ['e', 'in']), w(['e', 'out'], ['out', 'in'])],
};
const skipDoc = (clusters: EffectCluster[]): EffectDoc => ({ pipeline: { ...SKIP_E, clusters }, places: {} });

describe('a drop just before a cluster that starts with an undrawn skip', () => {
  const doc = skipDoc([{ id: 'g', members: ['q', 'blur'] }, { id: 'h', members: ['e'] }]);
  const order = rackSource(doc).order!;

  it('lands before the skip under stageMove', () => {
    expect(order.items.map((i) => i.id)).toEqual(['src', 'blur', 'mix', 'e', 'out']);
    const next = stageMove(doc, order, { id: 'e', from: 3, to: 1, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'e', 'q', 'blur', 'mix', 'out']);
  });

  it('lands before the skip under clusterMove', () => {
    const next = clusterMove(doc, order, ['src', 'g', 'mix', 'h', 'out'], { id: 'h', from: 3, to: 1, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'e', 'q', 'blur', 'mix', 'out']);
  });

  it('lands past the end of a last unit that ends on an undrawn skip', () => {
    const decision = SKIP.stages.find((s) => s.id === 'q')!;
    const pipeline: EffectPipeline = {
      stages: [io('src', { inputs: [] }), io('a'), io('x'), decision, io('blur'), io('mix'), io('out', { outputs: [] })],
      wires: [
        w(['src', 'out'], ['a', 'in']), w(['a', 'out'], ['x', 'in']), w(['x', 'out'], ['q', 'in']),
        w(['q', 'yes'], ['blur', 'in']), w(['q', 'no'], ['mix', 'in']), w(['blur', 'out'], ['mix', 'in']), w(['mix', 'out'], ['out', 'in']),
      ],
      clusters: [{ id: 'k', members: ['x', 'q'] }, { id: 'p', members: ['a', 'k'] }],
    };
    const d: EffectDoc = { pipeline, places: {} };
    const o = rackSource(d).order!;
    expect(o.items.some((i) => i.id === 'q')).toBe(false);
    const next = clusterMove(d, o, ['a', 'k'], { id: 'a', from: 0, to: 2, order: [] })!;
    expect(mainChain(next.pipeline).slice(0, 4)).toEqual(['src', 'x', 'q', 'a']);
  });
});
