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

describe('history.activeJournal and journal.observe', () => {
  it('answers the open journal while it is active, and reports its pushes to its observers', () => {
    const adapter = { n: 0 };
    const parent = createHistory(adapter);
    expect(parent.activeJournal?.()).toBeNull();
    const j = parent.beginJournal({ label: 'a' });
    expect(parent.activeJournal?.()).toBe(j);
    const steps: string[] = [];
    j.observe((step) => steps.push(step.kind));
    const op = { apply: () => { adapter.n++; }, invert: () => ({ apply: () => { adapter.n--; } }) } as never;
    j.applyBatch([op], 'bump');
    j.undo();
    expect(steps).toEqual(['push', 'undo']);
    j.suspend();
    expect(parent.activeJournal?.()).toBeNull();
  });
});
