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

describe('journal exclusivity', () => {
  it('refuses a second journal while one is active', () => {
    const h = createHistory({ values: [] as number[] });
    h.beginJournal({ label: 'a' });
    expect(() => h.beginJournal({ label: 'b' })).toThrow(/already active/);
  });

  it('refuses a second journal after the first is resumed', () => {
    const h = createHistory({ values: [] as number[] });
    const j1 = h.beginJournal({ label: 'a' });
    j1.suspend();
    h.resumeJournal(j1);
    expect(j1.isActive()).toBe(true);
    expect(() => h.beginJournal({ label: 'b' })).toThrow(/already active/);
  });

  it('refuses to resume a journal while another one is active', () => {
    const h = createHistory({ values: [] as number[] });
    const j1 = h.beginJournal({ label: 'a' });
    j1.suspend();
    const j2 = h.beginJournal({ label: 'b' });
    expect(() => h.resumeJournal(j1)).toThrow(/already active/);
    expect(j1.isActive()).toBe(false);
    expect(j2.isActive()).toBe(true);
  });

  it('allows resuming once the other journal closes', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    const j1 = h.beginJournal({ label: 'a' });
    j1.applyOps([pushOp(1)], 'one');
    j1.suspend();
    const j2 = h.beginJournal({ label: 'b' });
    j2.applyOps([pushOp(2)], 'two');
    j2.commit('b');
    h.resumeJournal(j1);
    expect(j1.isActive()).toBe(true);
    j1.applyOps([pushOp(3)], 'three');
    j1.commit('a');
    expect(adapter.values).toEqual([1, 2, 3]);
    expect(h.entries().undo.map((e) => e.label)).toEqual(['b', 'a']);
  });

  it('still refuses every mutating call on a committed journal', () => {
    const h = createHistory({ values: [] as number[] });
    const j = h.beginJournal({ label: 'a' });
    j.applyOps([pushOp(0)], 'zero');
    j.commit('a');
    expect(j.isActive()).toBe(false);
    expect(() => h.resumeJournal(j)).toThrow(/not resumable/);
    expect(() => j.applyOps([pushOp(1)], 'x')).toThrow(/not active/);
  });

  it('refuses to walk the parent under an active journal, and leaves both as they were', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    h.applyOps([pushOp(1)], 'one');
    h.applyOps([pushOp(2)], 'two');
    h.undo();
    const j = h.beginJournal({ label: 'j' });
    j.applyOps([pushOp(3)], 'three');
    expect(() => h.undo()).toThrow(/journal is already active/);
    expect(() => h.redo()).toThrow(/journal is already active/);
    expect(() => h.goto(0)).toThrow(/journal is already active/);
    expect(adapter.values).toEqual([1, 3]);
    j.cancel();
    expect(adapter.values).toEqual([1]);
    h.undo();
    expect(adapter.values).toEqual([]);
  });

  it('walks the parent again once the journal is suspended', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    h.applyOps([pushOp(1)], 'one');
    const j = h.beginJournal({ label: 'j' });
    j.suspend();
    h.undo();
    expect(adapter.values).toEqual([]);
  });
});
