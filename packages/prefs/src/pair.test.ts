import { describe, expect, it } from 'vitest';
import { pairRuns } from './pair';
import type { PrefLeaf, PrefPair } from './schema';

const leaf = (name: string, pair?: PrefPair): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...(pair ? { pair } : {}) });

const own = (item: readonly [string, PrefLeaf]) => item;

describe('pairRuns', () => {
  it('merges neighbors a pair names into one run, and leaves every other item a run of its own', () => {
    const items = [
      ['x', leaf('X', { with: 'y', label: 'Position' })],
      ['y', leaf('Y')],
      ['w', leaf('W')],
    ] as const;
    expect(pairRuns(items, own)).toEqual([
      { items: [items[0], items[1]], pair: { key: 'x', label: 'Position' } },
      { items: [items[2]] },
    ]);
  });

  it('is no pair for a leaf whose partner is absent, or is not its neighbor', () => {
    const lone = [['x', leaf('X', { with: 'y', label: 'Position' })], ['w', leaf('W')]] as const;
    expect(pairRuns(lone, own)).toEqual([{ items: [lone[0]] }, { items: [lone[1]] }]);
    const apart = [['x', leaf('X', { with: 'y', label: 'Position' })], ['w', leaf('W')], ['y', leaf('Y')]] as const;
    expect(pairRuns(apart, own).map((run) => run.pair)).toEqual([undefined, undefined, undefined]);
  });

  it('ends a run at an item that names no leaf', () => {
    const items = ['x', 'gap', 'y'];
    const leaves: Record<string, PrefLeaf> = { x: leaf('X', { with: 'y' }), y: leaf('Y') };
    const runs = pairRuns(items, (key) => (leaves[key] ? [key, leaves[key]] : undefined));
    expect(runs).toEqual([{ items: ['x'] }, { items: ['gap'] }, { items: ['y'] }]);
  });
});
