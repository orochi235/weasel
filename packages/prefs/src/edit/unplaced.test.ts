import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { stillUnplaced, unplacedAt } from './unplaced';

const leaf = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const UNPLACED: PrefGroup = {
  name: '',
  children: { glow: leaf('Glow'), motion: { name: 'Motion', children: { ease: leaf('Ease'), lag: leaf('Lag') } } },
};

describe('what is still unplaced', () => {
  it('drops a leaf the schema holds by key, wherever it sits, and a group left with none', () => {
    const schema: PrefGroup = { name: '', children: { view: { name: 'View', children: { ease: leaf('Easing') } } } };
    const left = stillUnplaced(UNPLACED, schema)!;
    expect(Object.keys(left.children)).toEqual(['glow', 'motion']);
    expect(Object.keys((left.children.motion as PrefGroup).children)).toEqual(['lag']);
    const both: PrefGroup = { name: '', children: { ease: leaf('Ease'), lag: leaf('Lag') } };
    expect(Object.keys(stillUnplaced(UNPLACED, both)!.children)).toEqual(['glow']);
  });

  it('is null once everything is held', () => {
    expect(stillUnplaced(UNPLACED, { name: '', children: { glow: leaf('a'), ease: leaf('b'), lag: leaf('c') } })).toBeNull();
  });

  it('finds a node by its keys', () => {
    expect(unplacedAt(UNPLACED, ['motion', 'lag'])).toMatchObject({ name: 'Lag' });
    expect(unplacedAt(UNPLACED, ['motion', 'none'])).toBeUndefined();
  });
});
