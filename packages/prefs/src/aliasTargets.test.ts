import { describe, expect, it } from 'vitest';
import type { PrefAlias } from './alias';
import { prefAliasTargets } from './aliasTargets';
import type { PrefGroup } from './groups';
import { prefJudge, prefReader } from './judge';
import type { PrefLeaf, PrefObject } from './schema';

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: 'About it.', default: true, ...extra }) as PrefLeaf;
const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const pointer = (of: string, name = '', description = ''): PrefAlias =>
  ({ kind: 'alias', name, description, default: undefined, of });

const over: PrefGroup = {
  name: 'Dialog',
  children: {
    on: flag('On'),
    view: { name: 'View', showIf: { path: 'on' }, children: { grid: flag('Show grid'), again: pointer('view.grid') as PrefLeaf } },
    stroke: {
      kind: 'object', name: 'Stroke', description: '', default: { width: 0, dash: 0, secret: 0 },
      children: {
        width: num('Width'),
        dash: num('Dash', { showIf: { path: 'stroke.width', above: 0 } }),
        cap: num('Cap', { enableIf: { path: 'stroke.width', above: 0 } }),
        secret: num('Secret', { hidden: true }),
      },
    } as PrefLeaf,
  },
};

const targets = (values: unknown, options?: Parameters<typeof prefAliasTargets>[2]) =>
  prefAliasTargets(over, (entry) => prefJudge(over, prefReader(over, values), entry), options);

describe('prefAliasTargets', () => {
  it('shows an alias as the leaf at its path, at that path, under the leaf\'s name and description', () => {
    expect(targets({}).shown(pointer('view.grid'))).toEqual({ path: 'view.grid', leaf: flag('Show grid') });
  });

  it('keeps the alias\'s own name and description where it gives them', () => {
    const shown = targets({}).shown(pointer('view.grid', 'Grid', 'Here too.'));
    expect(shown?.leaf).toMatchObject({ kind: 'boolean', name: 'Grid', description: 'Here too.' });
  });

  it('follows an alias of an alias to the leaf at its end', () => {
    expect(targets({}).shown(pointer('view.again'))?.path).toBe('view.grid');
  });

  it('shows nothing for an alias of no leaf, and for one whose leaf the schema\'s conditions leave out', () => {
    expect(targets({}).shown(pointer('view.gone'))).toBeUndefined();
    expect(targets({ on: false }).shown(pointer('view.grid'))).toBeUndefined();
    expect(targets({ on: false }, { markHidden: true }).shown(pointer('view.grid'))?.path).toBe('view.grid');
  });

  it('leaves out the fields of the leaf a `showIf` hides or `hidden` marks, unless the surface draws them', () => {
    const fields = (values: unknown, options?: Parameters<typeof prefAliasTargets>[2]): string[] =>
      Object.keys((targets(values, options).shown(pointer('stroke'))!.leaf as PrefObject).children);
    expect(fields({})).toEqual(['width', 'cap']);
    expect(fields({ stroke: { width: 2 } })).toEqual(['width', 'dash', 'cap']);
    expect(fields({}, { showHidden: true })).toEqual(['width', 'cap', 'secret']);
    expect(fields({}, { markHidden: true })).toEqual(['width', 'dash', 'cap']);
  });

  it('says which fields of the schema are disabled, and which hidden on a surface that draws those', () => {
    expect(targets({}).disabledAt('stroke.cap')).toBe(true);
    expect(targets({ stroke: { width: 2 } }).disabledAt('stroke.cap')).toBe(false);
    expect(targets({}).hiddenAt).toBeUndefined();
    expect(targets({}, { markHidden: true }).hiddenAt?.('stroke.dash')).toBe(true);
  });
});
