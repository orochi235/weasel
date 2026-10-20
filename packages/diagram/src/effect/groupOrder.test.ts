import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import { contains, type Rect } from '../groupFixture';
import type { LookOrder } from './draw';
import { editorScene } from './editorMapping';
import { groupLabelIdOf } from '../dataGroups';
import { groupMove, stageMove, type ReorderSource } from './editorReorder';
import { groupGripOf, groupRuns, groupSlotsAt } from './groupOrder';
import { mainChain } from './mainChain';
import { io, w } from './skipFixture';
import type { EffectDoc, EffectGroup, EffectPipeline } from './types';

const CHAIN: readonly string[] = ['src', 'a', 'b', 'c', 'd', 'out'];
const PIPELINE: EffectPipeline = {
  stages: [io('src', { inputs: [] }), io('a'), io('b'), io('c'), io('d'), io('out', { outputs: [] }), io('side', { inputs: [] })],
  wires: CHAIN.slice(1).map((id, k) => w([CHAIN[k]!, 'out'], [id, 'in'])),
};
const withGroups = (groups: EffectGroup[]): EffectPipeline => ({ ...PIPELINE, groups });
const docOf = (groups: EffectGroup[]): EffectDoc => ({ pipeline: withGroups(groups), places: {} });
const ORDER: LookOrder = { axis: 'x', items: CHAIN.map((id) => ({ id })) };
const move = (doc: EffectDoc, id: string, to: number) => stageMove(doc, ORDER, { id, from: CHAIN.indexOf(id), to, order: [] });

describe('groupRuns', () => {
  it('gives each group the chain indices its members span', () => {
    const runs = groupRuns(withGroups([{ id: 'g', members: ['b', 'c', 'side'] }]), CHAIN);
    expect(runs.get('g')).toEqual({ first: 2, last: 3 });
  });

  it('gives a split group no run', () => {
    expect(groupRuns(withGroups([{ id: 'g', members: ['a', 'c'] }]), CHAIN).get('g')).toBeNull();
  });

  it('counts members through nested groups', () => {
    const runs = groupRuns(withGroups([{ id: 'g', members: ['a', 'b'] }, { id: 'h', members: ['g', 'c'] }]), CHAIN);
    expect(runs.get('h')).toEqual({ first: 1, last: 3 });
    expect(runs.get('g')).toEqual({ first: 1, last: 2 });
  });

  it('leaves out a group with no stage on the chain', () => {
    expect(groupRuns(withGroups([{ id: 'g', members: ['side'] }]), CHAIN).has('g')).toBe(false);
  });
});

describe('stageMove with groups', () => {
  it('refuses a stage dropped into the middle of a group', () => {
    expect(move(docOf([{ id: 'g', members: ['a', 'b'] }]), 'c', 2)).toBeNull();
  });

  it('refuses a member dragged out of its own group', () => {
    expect(move(docOf([{ id: 'g', members: ['a', 'b'] }]), 'a', 5)).toBeNull();
  });

  it('refuses a drop that splits only an outer group', () => {
    expect(move(docOf([{ id: 'g', members: ['a', 'b'] }, { id: 'h', members: ['g', 'c'] }]), 'd', 3)).toBeNull();
  });

  it('allows a drop that keeps every group whole', () => {
    const next = move(docOf([{ id: 'g', members: ['a', 'b'] }]), 'd', 1)!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'd', 'a', 'b', 'c', 'out']);
  });

  it('still allows a drop when the group was already split', () => {
    const next = move(docOf([{ id: 'g', members: ['a', 'c'] }]), 'd', 1)!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'd', 'a', 'b', 'c', 'out']);
  });

  it('draws a split group around the stage between its members under rack', () => {
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
const NESTED: EffectGroup[] = [{ id: 'g', label: 'Inner', members: ['a', 'b'] }, { id: 'h', label: 'Outer', members: ['g', 'c'] }];

describe('groupGripOf', () => {
  it('is the band from the top of the box to the top of its highest member', () => {
    const source = rackSource(docOf(NESTED));
    const box = source.boxOf('g')!;
    const grip = groupGripOf(source.doc, 'g', source.boxOf)!;
    expect(grip).toEqual({ x: box.x, y: box.y, width: box.width, height: Math.min(source.boxOf('a')!.y, source.boxOf('b')!.y) - box.y });
    expect(contains(grip, source.boxOf(groupLabelIdOf('g'))!)).toBe(true);
  });
});

describe('groupSlotsAt', () => {
  it('picks the innermost group whose title holds the press', () => {
    const source = rackSource(docOf(NESTED));
    const slots = groupSlotsAt(source, middle(source.boxOf(groupLabelIdOf('g'))!))!;
    expect(slots.items.map((i) => i.id)).toEqual(['g', 'c']);
    expect(slots.items[0]!.grip).toEqual(groupGripOf(source.doc, 'g', source.boxOf));
    expect([...slots.items[0]!.carries!].sort()).toEqual(['a', 'b', 'g', groupLabelIdOf('g')].sort());
    expect(slots.items[1]!.grip).toBeNull();
  });

  it('gives an outer group the top level as its siblings, carrying the groups inside it', () => {
    const source = rackSource(docOf(NESTED));
    const slots = groupSlotsAt(source, middle(source.boxOf(groupLabelIdOf('h'))!))!;
    expect(slots.items.map((i) => i.id)).toEqual(['src', 'h', 'd', 'out']);
    expect([...slots.items[1]!.carries!].sort()).toEqual(['a', 'b', 'c', 'g', 'h', groupLabelIdOf('g'), groupLabelIdOf('h')].sort());
  });

  it('has no slots on a group with no stage on the line', () => {
    const source = rackSource(docOf([{ id: 's', label: 'Side', members: ['side'] }]));
    expect(source.boxOf(groupLabelIdOf('s'))).toBeDefined();
    expect(groupSlotsAt(source, middle(source.boxOf(groupLabelIdOf('s'))!))).toBeNull();
  });

  it('has no slots on a split group, and does not throw', () => {
    const source = rackSource(docOf([{ id: 'g', label: 'Split', members: ['a', 'c'] }]));
    expect(groupSlotsAt(source, middle(source.boxOf(groupLabelIdOf('g'))!))).toBeNull();
  });

  it('has no slots off every title', () => {
    const source = rackSource(docOf(NESTED));
    expect(groupSlotsAt(source, middle(source.boxOf('a')!))).toBeNull();
  });
});

describe('groupMove', () => {
  it('moves a group past the next unit', () => {
    const doc = docOf([{ id: 'g', members: ['a', 'b'] }]);
    const units = ['src', 'g', 'c', 'd', 'out'];
    const next = groupMove(doc, ORDER, units, { id: 'g', from: 1, to: 3, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'd', 'out']);
  });

  it('moves a group among its parent’s members, keeping the parent whole', () => {
    const next = groupMove(docOf(NESTED), ORDER, ['g', 'c'], { id: 'g', from: 0, to: 2, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'd', 'out']);
    expect(groupRuns(next.pipeline, mainChain(next.pipeline)).get('h')).toEqual({ first: 1, last: 3 });
  });

  it('moves a stage among a group’s members', () => {
    const next = groupMove(docOf(NESTED), ORDER, ['g', 'c'], { id: 'c', from: 1, to: 0, order: [] })!;
    expect(mainChain(next.pipeline)).toEqual(['src', 'c', 'a', 'b', 'd', 'out']);
  });

  it('refuses a split group', () => {
    const units = ['src', 'g', 'b', 'd', 'out'];
    expect(groupMove(docOf([{ id: 'g', members: ['a', 'c'] }]), ORDER, units, { id: 'g', from: 1, to: 3, order: [] })).toBeNull();
  });
});
