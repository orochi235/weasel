import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { conditionProblems } from './conditionMarks';

const flag = (more: object = {}): PrefLeaf => ({ kind: 'boolean', name: 'On', description: '', default: false, ...more });

describe('what is wrong with the conditions a schema holds, by the row that holds each', () => {
  it('lists a leaf\'s and a group\'s by tree path, and nothing for a node whose conditions are sound', () => {
    const root: PrefGroup = { name: 'Root', children: {
      a: { name: 'A', enableIf: { path: 'a.gone' }, children: {
        on: flag(),
        size: { kind: 'number', name: 'Size', description: '', default: 0, showIf: { path: 'a.on', is: 'yes' }, enableIf: { path: 'a.on' } },
        fine: flag({ showIf: { path: 'a.on', is: true } }),
        never: flag({ showIf: { path: 'a.size', in: [] } }),
      } },
    } };
    const found = conditionProblems(root);
    expect([...found.keys()]).toEqual(['a', 'a/size', 'a/never']);
    expect(found.get('a/never')).toMatchObject([{ field: 'showIf', code: 'never' }]);
    expect(found.get('a')).toMatchObject([{ field: 'enableIf', code: 'no-leaf' }]);
    expect(found.get('a/size')).toMatchObject([{ field: 'showIf', code: 'value' }]);
  });

  it('puts a section member\'s on its row under the section, and the root\'s own under null', () => {
    const node: PrefSection = { name: 'Properties', showIf: { path: 'nope' }, members: {
      pose: { name: 'Pose', members: { 'pose.x': flag({ showIf: { path: 'pose.gone' } }) } },
    } };
    expect([...conditionProblems(node).keys()]).toEqual([null, 'pose/pose.x']);
  });

  it('puts the condition of a list\'s entry on the list', () => {
    const root: PrefGroup = { name: 'Root', children: {
      rows: { kind: 'list', name: 'Rows', description: '', default: [], item: flag({ enableIf: { path: 'gone' } }) } as PrefLeaf,
    } };
    expect([...conditionProblems(root).keys()]).toEqual(['rows']);
  });

  it('marks a showIf on a list\'s entry, which is never hidden, and not its enableIf', () => {
    const root: PrefGroup = { name: 'Root', children: {
      on: flag(),
      rows: { kind: 'list', name: 'Rows', description: '', default: [], item: flag({ showIf: { path: 'on' }, enableIf: { path: 'on' } }) } as PrefLeaf,
      keyed: { kind: 'map', name: 'Keyed', description: '', default: {}, item: {
        kind: 'object', name: 'Row', description: '', default: {}, children: { fine: flag({ showIf: { path: 'on' } }) },
      } } as unknown as PrefLeaf,
    } };
    const found = conditionProblems(root);
    expect([...found.keys()]).toEqual(['rows']);
    expect(found.get('rows')).toMatchObject([{ field: 'showIf', code: 'item-show' }]);
  });

  it('puts the conditions inside a union\'s variants on the union, a variant\'s own and its fields\'', () => {
    const root: PrefGroup = { name: 'Root', children: {
      fill: { kind: 'union', name: 'Fill', description: '', default: { type: 'flat' }, tag: 'type', variants: {
        flat: { kind: 'object', name: 'Flat', description: '', default: {}, showIf: { path: 'gone' }, children: {} },
        ramp: { kind: 'object', name: 'Ramp', description: '', default: {}, children: {
          angle: flag({ enableIf: { path: 'nowhere' } }),
        } },
      } } as unknown as PrefLeaf,
      fine: flag(),
    } };
    const found = conditionProblems(root);
    expect([...found.keys()]).toEqual(['fill']);
    expect(found.get('fill')).toMatchObject([{ field: 'showIf', path: 'gone' }, { field: 'enableIf', path: 'nowhere' }]);
  });

  it('puts the conditions of the fields inside a list\'s object entry on each field\'s own row', () => {
    const root: PrefGroup = { name: 'Root', children: {
      rows: { kind: 'list', name: 'Rows', description: '', default: [], item: {
        kind: 'object', name: 'Row', description: '', default: {}, children: { on: flag({ showIf: { path: 'gone' } }) },
      } } as unknown as PrefLeaf,
    } };
    expect([...conditionProblems(root).keys()]).toEqual(['rows/on']);
  });
});
