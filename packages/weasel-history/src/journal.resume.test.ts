import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('history.resumeJournal', () => {
  it('re-activates a suspended journal so applyBatch works again', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.suspend();

    parent.resumeJournal(j);
    expect(j.isActive()).toBe(true);
    j.applyBatch([pushOp(2)], 'b');
    expect(adapter.values).toEqual([1, 2]);
  });

  it('the resumed journal preserves its inner undo stack — undo reaches pre-suspend state', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2)], 'b');
    j.suspend();

    parent.resumeJournal(j);
    j.undo();
    expect(adapter.values).toEqual([1]);
    j.undo();
    expect(adapter.values).toEqual([]);
  });

  it('resuming an already-committed journal throws', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.commit('x');

    expect(() => parent.resumeJournal(j)).toThrow();
  });

  it('resuming an already-cancelled journal throws', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.cancel();

    expect(() => parent.resumeJournal(j)).toThrow();
  });
});
