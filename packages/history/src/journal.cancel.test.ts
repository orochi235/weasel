import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

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

describe('Journal.cancel', () => {
  it('rolls the scene back via inverses and pushes nothing to parent', () => {
    const adapter = { values: [10] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2)], 'b');
    expect(adapter.values).toEqual([10, 1, 2]);

    j.cancel();

    expect(adapter.values).toEqual([10]);
    expect(parent.entries().undo.length).toBe(0);
  });

  it('closes the journal; further calls throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.cancel();

    expect(j.isActive()).toBe(false);
    expect(() => j.commit('after')).toThrow();
  });

  it('cancel on an empty journal is a no-op', () => {
    const adapter = { values: [5] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.cancel();
    expect(adapter.values).toEqual([5]);
    expect(parent.entries().undo.length).toBe(0);
  });

  it('throws when cancelling a suspended journal', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });
    j.suspend();
    expect(() => j.cancel()).toThrow();
  });
});
