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

describe('prefAliasedLeaf and the access letter', () => {
  const lettered = { ...grid, access: 'G' } as PrefLeaf;

  it('keeps the target’s letter under the target’s name, and drops it under a name of the alias’s own', () => {
    expect(prefAliasedLeaf(alias(), lettered).access).toBe('G');
    expect(prefAliasedLeaf(alias({ name: 'Show lattice' }), lettered).access).toBeUndefined();
    expect(prefAliasedLeaf(alias({ name: 'Show lattice', access: 'L' }), lettered).access).toBe('L');
  });
});

describe('prefAliasedLeaf and where the leaf sits', () => {
  const placed = { ...grid, pair: { with: 'view.y' }, heading: true } as PrefLeaf;

  it('drops the target’s pair and heading, which name the target’s place, and takes the alias’s own', () => {
    const drawn = prefAliasedLeaf(alias(), placed);
    expect(drawn.pair).toBeUndefined();
    expect(drawn.heading).toBeUndefined();
    const own = prefAliasedLeaf(alias({ pair: { with: 'quick.y' }, heading: true }), placed);
    expect(own.pair).toEqual({ with: 'quick.y' });
    expect(own.heading).toBe(true);
  });
});
