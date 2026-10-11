import { describe, expect, it } from 'vitest';
import { PREF_KIND_TRAITS, prefDrawsSeveral, prefIsCompound } from './kinds';
import { PREF_KINDS } from './schema';

const leaf = (kind: string) => ({ kind });

describe('built-in kind traits', () => {
  it('covers exactly the built-in kinds', () => {
    expect(Object.keys(PREF_KIND_TRAITS).sort()).toEqual(Object.keys(PREF_KINDS).sort());
  });

  it('calls a kind compound when its value is made of other leaves', () => {
    expect(['object', 'list', 'map', 'union'].map(leaf).every(prefIsCompound)).toBe(true);
    expect(['number', 'enum', 'paint', 'action', 'alias', 'my-kind'].map(leaf).some(prefIsCompound)).toBe(false);
  });

  it('says an action, like every compound kind, is no single control', () => {
    expect(['object', 'list', 'map', 'union', 'action'].map(leaf).every(prefDrawsSeveral)).toBe(true);
    expect(['number', 'string', 'color', 'field', 'my-kind', 'toString'].map(leaf).some(prefDrawsSeveral)).toBe(false);
  });
});
