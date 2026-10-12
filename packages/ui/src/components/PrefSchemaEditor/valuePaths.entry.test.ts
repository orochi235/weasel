import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf, PrefList, PrefObject } from '@weasel-js/prefs';
import { renameKey } from './schemaEdit';
import { rebaseValuePaths } from './valuePaths';

const num = (name: string, more: object = {}): PrefLeaf => ({ kind: 'number', name, description: '', default: 0, ...more });
const flag = (name: string, more: object = {}): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false, ...more });
const object = (name: string, children: Record<string, PrefLeaf>, more: object = {}): PrefLeaf =>
  ({ kind: 'object', name, description: '', default: {}, children, ...more }) as PrefLeaf;
const list = (name: string, item: PrefLeaf): PrefLeaf => ({ kind: 'list', name, description: '', default: [], item }) as PrefLeaf;

const step = object('Step', { mode: flag('Mode'), size: num('Size', { showIf: { from: 'item', path: 'mode' } }) });
const phase = object('Phase', {
  mode: flag('Mode'),
  hold: num('Hold', { showIf: { all: [{ from: 'item', path: 'mode' }, { path: 'mode' }] } }),
  steps: list('Steps', step),
}, { enableIf: { from: 'item', path: 'mode' } });
const ROOT: PrefGroup = { name: 'Root', children: { mode: flag('Mode'), look: { name: 'Look', children: { phases: list('Phases', phase) } } } };

const itemOf = (root: PrefGroup): PrefObject => ((root.children.look as PrefGroup).children.phases as PrefList).item as PrefObject;
const holdOf = (root: PrefGroup): PrefLeaf => itemOf(root).children.hold as PrefLeaf;
const sizeOf = (root: PrefGroup): PrefLeaf => ((itemOf(root).children.steps as PrefList).item as PrefObject).children.size as PrefLeaf;

describe('a test that reads from the entry, as the schema is edited', () => {
  it('follows a renamed field of the same entry, in a field\'s condition and in the item\'s own', () => {
    const next = rebaseValuePaths(ROOT, [['look.phases.*.mode', 'look.phases.*.kind']]);
    expect(holdOf(next).showIf).toEqual({ all: [{ from: 'item', path: 'kind' }, { path: 'mode' }] });
    expect(itemOf(next).enableIf).toEqual({ from: 'item', path: 'kind' });
  });

  it('is left alone by a rename of a field in another entry, the one above it or the one inside it', () => {
    const outer = rebaseValuePaths(ROOT, [['look.phases.*.mode', 'look.phases.*.kind']]);
    expect(sizeOf(outer).showIf).toBe(sizeOf(ROOT).showIf);
    const inner = rebaseValuePaths(ROOT, [['look.phases.*.steps.*.mode', 'look.phases.*.steps.*.kind']]);
    expect(sizeOf(inner).showIf).toEqual({ from: 'item', path: 'kind' });
    expect(holdOf(inner).showIf).toBe(holdOf(ROOT).showIf);
  });

  it('is left alone by a rename outside the entry, which the tests that read the root follow', () => {
    const next = renameKey(ROOT, 'mode', 'kind');
    expect(holdOf(next).showIf).toEqual({ all: [{ from: 'item', path: 'mode' }, { path: 'kind' }] });
    expect(itemOf(next).enableIf).toBe(itemOf(ROOT).enableIf);
    expect(sizeOf(next)).toBe(sizeOf(ROOT));
  });

  it('keeps its path when the list it sits in is renamed or moved', () => {
    const renamed = renameKey(ROOT, 'look/phases', 'stages');
    const item = ((renamed.children.look as PrefGroup).children.stages as PrefList).item as PrefObject;
    expect(item).toBe(itemOf(ROOT));
  });
});
