import { describe, expect, it } from 'vitest';
import { prefAliasedLeaf, type PrefAlias } from './alias';
import type { PrefLeaf } from './schema';

const grid = { kind: 'boolean', name: 'Grid', description: '', default: false, short: ['Grd'] } as PrefLeaf;
const alias = (extra: Partial<PrefAlias> = {}): PrefAlias =>
  ({ kind: 'alias', of: 'view.grid', name: '', description: '', default: undefined, ...extra }) as PrefAlias;

describe('prefAliasedLeaf', () => {
  it('keeps the target’s short forms under the target’s name', () => {
    expect(prefAliasedLeaf(alias(), grid).short).toEqual(['Grd']);
  });

  it('drops the target’s short forms under a name of the alias’s own, and takes the alias’s', () => {
    expect(prefAliasedLeaf(alias({ name: 'Snap to grid' }), grid).short).toBeUndefined();
    expect(prefAliasedLeaf(alias({ name: 'Snap to grid', short: ['Snap'] }), grid).short).toEqual(['Snap']);
    expect(prefAliasedLeaf(alias({ short: ['G'] }), grid).short).toEqual(['G']);
  });
});
