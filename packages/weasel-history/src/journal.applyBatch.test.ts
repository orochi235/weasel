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

describe('Journal.applyBatch / undo / redo', () => {
  it('applyBatch applies ops to the adapter and records on the inner history', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    expect(adapter.values).toEqual([1]);
    expect(j.canUndo()).toBe(true);
    expect(j.canRedo()).toBe(false);
  });

  it('applyBatch does NOT push to the parent history', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    expect(parent.canUndo()).toBe(false);
  });

  it('undo replays inverses on the adapter via the inner', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    j.applyBatch([pushOp(2)], 'second');
    expect(adapter.values).toEqual([1, 2]);

    j.undo();
    expect(adapter.values).toEqual([1]);
    j.undo();
    expect(adapter.values).toEqual([]);
  });

  it('redo re-applies forward ops', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'edit' });

    j.applyBatch([pushOp(1)], 'first');
    j.undo();
    expect(adapter.values).toEqual([]);

    j.redo();
    expect(adapter.values).toEqual([1]);
  });
});
