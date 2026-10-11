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
      } },
    } };
    const found = conditionProblems(root);
    expect([...found.keys()]).toEqual(['a', 'a/size']);
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
});
