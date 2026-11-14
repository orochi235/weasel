import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefList } from '@weasel-js/prefs';
import { conditionProblems } from './conditionMarks';
import { packDraft, unpackDraft } from './draft';
import { childrenOf, nodeAt, renameKey, setAttribute, valuePathOf } from './schemaEdit';
import { diffSchemas, printSchema } from './schemaExport';

const held = { kind: 'boolean', name: 'Held', description: '', default: false } as PrefLeaf;
const gain = { kind: 'number', name: 'Gain', description: '', default: 0, enableIf: { from: 'item', path: 'held' } } as PrefLeaf;
const phases = {
  kind: 'list', name: 'Phases', description: '', default: [],
  item: { kind: 'object', name: 'Phase', description: '', default: {}, children: { held, gain } },
} as PrefLeaf;
const tags = { kind: 'list', name: 'Tags', description: '', default: [], item: { kind: 'string', name: 'Tag', description: '', default: '' } } as PrefLeaf;
const ROOT: PrefGroup = { name: 'Prefs', children: { view: { name: 'View', children: { phases, tags } } } };

describe('the fields of a list\'s object entry, as rows', () => {
  it('are the list\'s children in the tree, and a list of plain entries holds none', () => {
    expect(Object.keys(childrenOf(phases) ?? {})).toEqual(['held', 'gain']);
    expect(childrenOf(tags)).toBeUndefined();
    expect(nodeAt(ROOT, 'view/phases/gain')).toBe(gain);
  });

  it('are stored at a path through the entry\'s step', () => {
    expect(valuePathOf(ROOT, 'view/phases/gain')).toBe('view.phases.*.gain');
  });

  it('take an edit into the entry, and leave the list\'s own attributes as they were', () => {
    const next = setAttribute(ROOT, 'view/phases/gain', 'name', 'Level');
    const list = nodeAt(next, 'view/phases') as PrefList;
    expect((list.item as unknown as { children: Record<string, PrefLeaf> }).children.gain!.name).toBe('Level');
    expect(list.name).toBe('Phases');
  });

  it('carry a rename into a condition that reads the entry', () => {
    const next = renameKey(ROOT, 'view/phases/held', 'hold');
    expect(nodeAt(next, 'view/phases/gain')!.enableIf).toEqual({ from: 'item', path: 'hold' });
  });

  it('report a field\'s change at its own row, not as a change to the list\'s entry', () => {
    const next = setAttribute(ROOT, 'view/phases/gain', 'name', 'Level');
    expect(diffSchemas(ROOT, next)).toEqual([{ op: 'attr', path: 'view/phases/gain', key: 'name', from: 'Gain', to: 'Level' }]);
  });

  it('print and pack as the entry they sit in', () => {
    expect(printSchema(ROOT)).toContain('item: {');
    expect(printSchema(ROOT).match(/gain:/g)).toHaveLength(1);
    expect(unpackDraft(JSON.parse(JSON.stringify(packDraft(ROOT, ROOT))), ROOT)).toEqual(ROOT);
  });

  it('mark a field\'s unsound condition on the field\'s row', () => {
    const broken = setAttribute(ROOT, 'view/phases/gain', 'enableIf', { from: 'item', path: 'nope' });
    expect([...conditionProblems(broken).keys()]).toEqual(['view/phases/gain']);
  });
});
