import { describe, expect, it } from 'vitest';
import { hasTag, matchQuery } from './match';

describe('matchQuery', () => {
  it('finds an entry by any of its text, ignoring case and surrounding space', () => {
    expect(matchQuery('  FLIP ', { text: ['Flip Horizontal'] })).toEqual({ by: 'text' });
    expect(matchQuery('mirror', { text: ['Flip', undefined, 'mirror the selection'] })).toEqual({ by: 'text' });
  });

  it('finds an entry by a tag the way it finds one by its text', () => {
    expect(matchQuery('Bool', { text: ['Union'], tags: ['boolean', 'pathfinder'] })).toEqual({ by: 'tag', tag: 'boolean' });
  });

  it('names text before a tag when both match', () => {
    expect(matchQuery('union', { text: ['Union'], tags: ['union-like'] })).toEqual({ by: 'text' });
  });

  it('is null when nothing matches', () => {
    expect(matchQuery('zzz', { text: ['Union'], tags: ['boolean'] })).toBeNull();
  });

  it('matches everything on an empty query', () => {
    expect(matchQuery('   ', { text: [] })).toEqual({ by: 'text' });
  });
});

describe('hasTag', () => {
  it('is an exact match', () => {
    expect(hasTag(['boolean'], 'boolean')).toBe(true);
    expect(hasTag(['boolean'], 'bool')).toBe(false);
    expect(hasTag(['boolean'], 'Boolean')).toBe(false);
    expect(hasTag(undefined, 'boolean')).toBe(false);
  });
});
