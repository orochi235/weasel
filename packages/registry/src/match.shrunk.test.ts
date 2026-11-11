import { describe, expect, it } from 'vitest';
import { matchQuery } from './match';

describe('matchQuery, shrunk', () => {
  it('finds a composed letter in text that writes it decomposed, and the reverse', () => {
    expect(matchQuery('é', { text: ['café'] })).toEqual({ by: 'text' });
    expect(matchQuery('é', { text: ['café'] })).toEqual({ by: 'text' });
    expect(matchQuery('e', { text: ['café'] })).toBeNull();
  });
});
