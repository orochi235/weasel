import { describe, expect, it } from 'vitest';
import { mergeContributions, suppressContributions } from './merge';
import type { TrialContribution } from './types';

const Glyph = () => null;

function toolbarItem(id: string): TrialContribution {
  return {
    id,
    region: 'toolbar',
    item: { icon: Glyph, label: id, onActivate: () => {} },
  };
}

describe('mergeContributions', () => {
  it('concatenates bundles in order', () => {
    const out = mergeContributions([toolbarItem('a')], [toolbarItem('b'), toolbarItem('c')]);
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('throws on a duplicate id, naming it', () => {
    expect(() => mergeContributions([toolbarItem('undo')], [toolbarItem('undo')])).toThrow(
      /duplicate contribution id "undo"/,
    );
  });

  it('accepts no bundles', () => {
    expect(mergeContributions()).toEqual([]);
  });
});

describe('suppressContributions', () => {
  it('removes the named ids', () => {
    const out = suppressContributions(
      [toolbarItem('a'), toolbarItem('b'), toolbarItem('c')],
      ['b'],
    );
    expect(out.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('throws on an id that is not there', () => {
    expect(() => suppressContributions([toolbarItem('a')], ['snapshto'])).toThrow(
      /cannot suppress "snapshto"/,
    );
  });

  it('is a no-op for an empty suppress list', () => {
    const bundle = [toolbarItem('a')];
    expect(suppressContributions(bundle, [])).toEqual(bundle);
  });
});
