import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

function pushOp(value: number): Op {
  const op: Op = {
    name: 'test:push',
    args: { value },
    apply(a) { (a as { values: number[] }).values.push(value); },
    invert: (): Op => ({
      name: 'test:pop',
      args: { value },
      apply(a) { (a as { values: number[] }).values.pop(); },
      invert: () => op,
    }),
  };
  return op;
}

describe('a journal inside a journal', () => {
  it('commits to its parent as one entry, which commits to the history as one', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const outer = h.beginJournal({ label: 'outer' });
    outer.applyBatch([pushOp(1)], 'one');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyBatch([pushOp(2)], 'two');
    inner.applyBatch([pushOp(3)], 'three');
    inner.commit('Inner');
    expect(outer.entries().undo.map((e) => e.label)).toEqual(['one', 'Inner']);
    outer.undo();
    expect(adapter.values).toEqual([1]);
    outer.commit('Outer');
    expect(h.undoDepth()).toBe(1);
  });

  it('cancels back to where its parent was', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const outer = h.beginJournal({ label: 'outer' });
    outer.applyBatch([pushOp(1)], 'one');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyBatch([pushOp(2)], 'two');
    inner.cancel();
    expect(adapter.values).toEqual([1]);
    expect(outer.entries().undo).toHaveLength(1);
  });

  it('refuses to open in a closed journal', () => {
    const h = createHistory({ values: [] as number[] });
    const outer = h.beginJournal({ label: 'outer' });
    outer.commit('done');
    expect(() => outer.beginJournal({ label: 'inner' })).toThrow(/not active/);
  });
});
