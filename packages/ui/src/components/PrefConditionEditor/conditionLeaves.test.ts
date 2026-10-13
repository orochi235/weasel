import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefList, PrefSection } from '@weasel-js/prefs';
import { conditionLeaves, leafKey, leafOf } from './conditionLeaves';

const flag: PrefLeaf = { kind: 'boolean', name: 'On', description: '', default: false };
const count: PrefLeaf = { kind: 'number', name: 'Count', description: '', default: 0 };
const mode = { kind: 'enum', name: 'Mode', description: '', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } as PrefLeaf;

describe('the leaves a condition may read', () => {
  it('lists each leaf holding a value by the path it is read at, a field of an object leaf among them', () => {
    const root: PrefGroup = { name: 'Root', children: {
      view: { name: 'View', children: {
        on: flag,
        rule: { kind: 'separator', name: '', description: '', default: undefined },
        stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: { width: count } } as PrefLeaf,
      } },
    } };
    expect(conditionLeaves(root).map((l) => l.path)).toEqual(['view.on', 'view.stroke', 'view.stroke.width']);
  });

  it('names a section root\'s leaf by its own key', () => {
    const node: PrefSection = { name: 'Properties', members: { pose: { name: 'Pose', members: { 'pose.x': count } }, 'data.on': flag } };
    expect(conditionLeaves(node).map((l) => l.path)).toEqual(['pose.x', 'data.on']);
  });
});

describe('the entry a condition\'s node is drawn in', () => {
  const phase = { kind: 'object', name: 'Phase', description: '', default: {}, children: { mode, count } } as PrefLeaf;
  const phases = { kind: 'list', name: 'Phases', description: '', default: [], item: phase } as PrefList;
  const root: PrefGroup = { name: 'Root', children: { mode, phases } };

  it('offers its own fields first, read from the entry, and then the schema\'s leaves', () => {
    expect(conditionLeaves(root, phases).map(({ path, from }) => [path, from])).toEqual([
      ['mode', 'item'], ['count', 'item'], ['mode', undefined], ['phases', undefined],
    ]);
    expect(conditionLeaves(root).map(({ path, from }) => [path, from])).toEqual([['mode', undefined], ['phases', undefined]]);
  });

  it('tells a field of the entry from a root pref at the same path', () => {
    const leaves = conditionLeaves(root, phases);
    const [inEntry, , atRoot] = leaves;
    expect(leafKey(inEntry!)).not.toBe(leafKey(atRoot!));
    expect(leafOf(leaves, { from: 'item', path: 'mode', is: 'a' })).toBe(inEntry);
    expect(leafOf(leaves, { path: 'mode', is: 'a' })).toBe(atRoot);
  });
});
