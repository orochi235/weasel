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

describe('Journal.commit', () => {
  it('flushes net forward ops to parent as one entry without re-applying', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2), pushOp(3)], 'b');
    expect(adapter.values).toEqual([1, 2, 3]);

    j.commit('Edit Path');

    // Scene unchanged by commit itself
    expect(adapter.values).toEqual([1, 2, 3]);
    // Parent has exactly one new entry
    expect(parent.entries().undo.length).toBe(1);
    expect(parent.entries().undo[0].label).toBe('Edit Path');
  });

  it('parent undo after commit rolls back the entire session', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2)], 'b');
    j.commit('Edit');

    parent.undo();
    expect(adapter.values).toEqual([]);
  });

  it('journal is closed after commit; further calls throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.commit('Edit');

    expect(j.isActive()).toBe(false);
    expect(() => j.applyBatch([pushOp(2)], 'x')).toThrow();
  });

  it('committing an empty journal pushes nothing to parent', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.commit('Empty');

    expect(parent.entries().undo.length).toBe(0);
    expect(j.isActive()).toBe(false);
  });
});
