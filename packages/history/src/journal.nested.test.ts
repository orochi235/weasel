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
    outer.applyOps([pushOp(1)], 'one');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([pushOp(2)], 'two');
    inner.applyOps([pushOp(3)], 'three');
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
    outer.applyOps([pushOp(1)], 'one');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([pushOp(2)], 'two');
    inner.cancel();
    expect(adapter.values).toEqual([1]);
    expect(outer.entries().undo).toHaveLength(1);
  });

  it('cancels a journal still open inside it along with its own entries', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const outer = h.beginJournal({ label: 'outer' });
    outer.applyOps([pushOp(1)], 'one');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([pushOp(2)], 'two');
    outer.cancel();
    expect(adapter.values).toEqual([]);
    expect(inner.isActive()).toBe(false);
    expect(h.activeJournal?.()).toBeNull();
  });

  it('refuses to commit while a journal inside it is open', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const outer = h.beginJournal({ label: 'outer' });
    outer.applyOps([pushOp(1)], 'one');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([pushOp(2)], 'two');
    expect(() => outer.commit('Outer')).toThrow(/still active/);
    expect(outer.isActive()).toBe(true);
    inner.commit('Inner');
    outer.commit('Outer');
    h.undo();
    expect(adapter.values).toEqual([]);
  });

  it('refuses to open in a closed journal', () => {
    const h = createHistory({ values: [] as number[] });
    const outer = h.beginJournal({ label: 'outer' });
    outer.commit('done');
    expect(() => outer.beginJournal({ label: 'inner' })).toThrow(/not active/);
  });

  it('cancels a suspended journal inside it along with its own entries', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const outer = h.beginJournal({ label: 'outer' });
    outer.applyOps([pushOp(1)], 'one');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([pushOp(2)], 'two');
    inner.suspend();
    outer.cancel();
    expect(adapter.values).toEqual([]);
    expect(() => h.resumeJournal(inner)).toThrow(/opened inside is not active/);
  });

  it('refuses to commit while a journal inside it is suspended', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const outer = h.beginJournal({ label: 'outer' });
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([pushOp(2)], 'two');
    inner.suspend();
    expect(() => outer.commit('Outer')).toThrow(/still active or suspended/);
  });

  it('resumes a suspended journal inside an active one', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const outer = h.beginJournal({ label: 'outer' });
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([pushOp(2)], 'two');
    inner.suspend();
    outer.applyOps([pushOp(3)], 'three');
    h.resumeJournal(inner);
    expect(inner.isActive()).toBe(true);
    expect(() => outer.beginJournal({ label: 'again' })).toThrow(/already active/);
    inner.commit('Inner');
    expect(outer.entries().undo.map((e) => e.label)).toEqual(['three', 'Inner']);
    expect(h.activeJournal?.()).toBe(outer);
  });
});
