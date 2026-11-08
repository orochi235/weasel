import { describe, expect, it } from 'vitest';
import { hitTargets, selectionFromHits } from './hitSelection';

describe('selectionFromHits', () => {
  it('replaces the selection with the hits', () => {
    expect(selectionFromHits(['a', 'b'], ['b', 'c'], false)).toEqual(['b', 'c']);
  });

  it('adds the hits to the selection when extending, keeping order and dropping repeats', () => {
    expect(selectionFromHits(['a', 'b'], ['b', 'c', 'c'], true)).toEqual(['a', 'b', 'c']);
  });

  it('returns a new array either way', () => {
    const hits = ['a'];
    expect(selectionFromHits([], hits, false)).not.toBe(hits);
  });
});

describe('hitTargets', () => {
  it('hands targetOf only the id, so an optional second parameter keeps its default', () => {
    const targetOf = (id: string, depth = 0) => (depth === 0 ? `${id}!` : id);
    expect(hitTargets(['a', 'b'], targetOf)).toEqual(['a!', 'b!']);
  });
});
