import { describe, expect, it } from 'vitest';
import { removeStages } from './edit';
import { groupStages, moveGroup, moveToGroup, nextGroupId, renameGroup, setGroupBox, ungroup } from './groupEdit';
import type { EffectDoc, EffectStage } from './types';

const stage = (id: string): EffectStage => ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
const wire = (id: string, from: string, to: string) => ({ id, from: { stage: from, port: 'out' }, to: { stage: to, port: 'in' } });

const DOC: EffectDoc = {
  pipeline: {
    stages: ['a', 'b', 'c', 'd'].map(stage),
    wires: [wire('w1', 'a', 'b'), wire('w2', 'b', 'c'), wire('w3', 'c', 'd')],
    groups: [{ id: 'outer', label: 'Outer', members: ['a', 'inner'] }, { id: 'inner', members: ['b', 'c'] }],
  },
  places: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 200, y: 0 }, d: { x: 300, y: 0 } },
};

const groups = (d: EffectDoc) => d.pipeline.groups ?? [];
const group = (d: EffectDoc, id: string) => groups(d).find((g) => g.id === id);

describe('groupStages', () => {
  it('nests a new group inside the group all its stages share, where the first one was', () => {
    const next = groupStages(DOC, ['b', 'c'], 'Pair');
    const id = nextGroupId(DOC.pipeline);
    expect(group(next, id)).toEqual({ id, label: 'Pair', members: ['b', 'c'] });
    expect(group(next, 'inner')!.members).toEqual([id]);
  });

  it('puts a group of stages from different groups at the top level, taking them out of their groups', () => {
    const next = groupStages(DOC, ['a', 'd']);
    const id = nextGroupId(DOC.pipeline);
    expect(group(next, id)).toEqual({ id, members: ['a', 'd'] });
    expect(group(next, 'outer')!.members).toEqual(['inner']);
  });

  it('mints an id no stage or group has', () => {
    const taken: EffectDoc = { ...DOC, pipeline: { ...DOC.pipeline, stages: [...DOC.pipeline.stages, stage('group')] } };
    expect(nextGroupId(taken.pipeline)).toBe('group-2');
  });

  it('makes nothing of no stages', () => {
    expect(groupStages(DOC, [])).toBe(DOC);
  });
});

describe('ungroup', () => {
  it('hands the members to its parent group, in its place, and drops its box', () => {
    const boxed = setGroupBox(DOC, 'inner', { x: 90, y: -10, width: 220, height: 80 });
    const next = ungroup(boxed, 'inner');
    expect(group(next, 'inner')).toBeUndefined();
    expect(group(next, 'outer')!.members).toEqual(['a', 'b', 'c']);
    expect(next.groupBoxes).toBeUndefined();
  });

  it('leaves the members of a top-level group at the top level', () => {
    const next = ungroup(DOC, 'outer');
    expect(groups(next).map((g) => g.id)).toEqual(['inner']);
  });
});

describe('renameGroup', () => {
  it('sets the label, and an empty one removes it', () => {
    expect(group(renameGroup(DOC, 'inner', 'Middle'), 'inner')!.label).toBe('Middle');
    expect(group(renameGroup(DOC, 'outer', ''), 'outer')).toEqual({ id: 'outer', members: ['a', 'inner'] });
  });
});

describe('moveToGroup', () => {
  it('moves stages into a group, out of the one they were in', () => {
    const next = moveToGroup(DOC, ['d'], 'inner');
    expect(group(next, 'inner')!.members).toEqual(['b', 'c', 'd']);
    const out = moveToGroup(next, ['b'], null);
    expect(group(out, 'inner')!.members).toEqual(['c', 'd']);
  });

  it('prunes a group left empty unless it has a box of its own', () => {
    const emptied = moveToGroup(DOC, ['b', 'c'], null);
    expect(group(emptied, 'inner')).toBeUndefined();
    expect(group(emptied, 'outer')!.members).toEqual(['a']);
    const boxed = setGroupBox(DOC, 'inner', { x: 0, y: 0, width: 10, height: 10 });
    expect(group(moveToGroup(boxed, ['b', 'c'], null), 'inner')!.members).toEqual([]);
  });

  it('refuses to put a group inside itself or an unknown group', () => {
    expect(moveToGroup(DOC, ['outer'], 'inner')).toBe(DOC);
    expect(moveToGroup(DOC, ['d'], 'nope')).toBe(DOC);
  });
});

describe('moveGroup', () => {
  it('moves member places, nested boxes, and the routes of wires inside, by one offset', () => {
    const doc: EffectDoc = {
      ...setGroupBox(DOC, 'inner', { x: 90, y: -10, width: 220, height: 80 }),
      routes: { w2: [{ x: 150, y: 40 }], w3: [{ x: 250, y: 40 }] },
    };
    const next = moveGroup(doc, 'outer', { x: 10, y: 20 });
    expect(next.places).toEqual({ a: { x: 10, y: 20 }, b: { x: 110, y: 20 }, c: { x: 210, y: 20 }, d: { x: 300, y: 0 } });
    expect(next.groupBoxes).toEqual({ inner: { x: 100, y: 10, width: 220, height: 80 } });
    expect(next.routes).toEqual({ w2: [{ x: 160, y: 60 }], w3: [{ x: 250, y: 40 }] });
  });
});

describe('removeStages', () => {
  it('drops the box of a group it leaves empty', () => {
    const boxed = setGroupBox(DOC, 'inner', { x: 0, y: 0, width: 10, height: 10 });
    const next = removeStages(boxed, ['b', 'c']);
    expect(group(next, 'inner')).toBeUndefined();
    expect(next.groupBoxes).toBeUndefined();
  });
});
