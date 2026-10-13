import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('history.beginJournal — at-most-one-active invariant', () => {
  it('allows a new journal after the previous one commits', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j1 = parent.beginJournal({ label: 'a' });
    j1.commit('first');
    expect(() => parent.beginJournal({ label: 'b' })).not.toThrow();
  });

  it('allows a new journal after the previous one cancels', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j1 = parent.beginJournal({ label: 'a' });
    j1.cancel();
    expect(() => parent.beginJournal({ label: 'b' })).not.toThrow();
  });
});
