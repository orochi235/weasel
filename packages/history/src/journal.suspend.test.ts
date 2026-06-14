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

describe('Journal.suspend', () => {
  it('marks the journal inactive but leaves the scene untouched', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.suspend();

    expect(j.isActive()).toBe(false);
    expect(adapter.values).toEqual([1]);
    expect(parent.entries().undo.length).toBe(0);
  });

  it('further operations on a suspended journal throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.suspend();

    expect(() => j.applyBatch([pushOp(1)], 'x')).toThrow();
    expect(() => j.undo()).toThrow();
    expect(() => j.redo()).toThrow();
  });
});
