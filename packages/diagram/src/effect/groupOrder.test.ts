import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import { contains, type Rect } from '../groupFixture';
import type { LookOrder } from './draw';
import { editorScene } from './editorMapping';
import { stageMove } from './editorReorder';
import { groupRuns } from './groupOrder';
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
