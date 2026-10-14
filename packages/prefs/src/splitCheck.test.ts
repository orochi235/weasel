import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { prefLeaves } from './helpers';
import { checkPrefSplits, prefSelectors } from './splitCheck';

const option = (value: string) => ({ value, label: value });
const leaf = (extra: object) => ({ name: 'x', description: '', ...extra });

const SCHEMA = {
  name: 'Test',
  children: {
    mode: leaf({ kind: 'enum', default: 'dark', options: [option('dark'), option('light')] }),
    size: leaf({ kind: 'enum', default: 's', options: [option('s'), option('m')], splitBy: ['mode'] }),
    script: leaf({ kind: 'enum', default: undefined, clearable: true, options: [option('super'), option('sub')] }),
    dash: leaf({ kind: 'enum', default: 'solid', options: [option('solid')], encoding: { read: () => 'solid', write: () => [] } }),
    on: leaf({ kind: 'boolean', default: true }),
    rule: leaf({ kind: 'separator', default: undefined, splitBy: ['mode'] }),
    good: leaf({ kind: 'number', default: 1, splitBy: ['mode'] }),
    bad: leaf({ kind: 'number', default: 1, splitBy: ['mode', 'nowhere', 'on', 'script', 'dash', 'size', 'mode'] }),
  },
} as unknown as PrefGroup;

describe('checkPrefSplits', () => {
  it('reports each entry that cannot be split by, with the leaf it is on, and nothing for a good list', () => {
    expect(checkPrefSplits(SCHEMA).map(({ code, at, path }) => [at, path, code])).toEqual([
      ['rule', undefined, 'valueless'],
      ['bad', 'nowhere', 'no-leaf'],
      ['bad', 'on', 'not-enum'],
      ['bad', 'script', 'clearable'],
      ['bad', 'dash', 'encoded'],
      ['bad', 'size', 'split'],
      ['bad', 'mode', 'twice'],
    ]);
  });
});

describe('prefSelectors', () => {
  it('holds the options of each leaf that can be split by, and no other', () => {
    expect([...prefSelectors(prefLeaves(SCHEMA))]).toEqual([['mode', ['dark', 'light']]]);
  });
});
