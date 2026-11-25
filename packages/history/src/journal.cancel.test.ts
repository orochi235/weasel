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

interface Box { x: string }

function setX(from: string, to: string): Op {
  return { apply(a: Box) { a.x = to; }, invert: () => setX(to, from) };
}

describe('Journal.cancel', () => {
  it('rolls the scene back via inverses and pushes nothing to parent', () => {
    const adapter = { values: [10] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyOps([pushOp(1)], 'a');
    j.applyOps([pushOp(2)], 'b');
    expect(adapter.values).toEqual([10, 1, 2]);

    j.cancel();

    expect(adapter.values).toEqual([10]);
    expect(parent.entries().undo.length).toBe(0);
  });

  it('closes the journal; further calls throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyOps([pushOp(1)], 'a');
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

  it('unwinds the journals inside it latest edit first, not in the order they opened', () => {
    const setX = (from: number, to: number): Op => ({
      name: 'test:setX',
      args: { from, to },
      apply(a: { x: number }) { a.x = to; },
      invert: () => setX(to, from),
    } as Op);
    const adapter = { x: 0 };
    const h = createHistory(adapter);
    const j = h.beginJournal({ label: 'outer' });
    const first = j.beginJournal({ label: 'first' });
    first.suspend();
    const second = j.beginJournal({ label: 'second' });
    second.applyOps([setX(0, 2)], 'two');
    second.suspend();
    h.resumeJournal(first);
    first.applyOps([setX(2, 3)], 'three');

    j.cancel();
    expect(adapter.x).toBe(0);
  });

  it('unwinds its own edits and a suspended journal inside it in the order they were made', () => {
    const box: Box = { x: '0' };
    const outer = createHistory(box).beginJournal({ label: 'outer' });
    const child = outer.beginJournal({ label: 'child' });
    child.applyOps([setX('0', 'a')], 'a');
    child.suspend();
    outer.applyOps([setX('a', 'b')], 'b');

    outer.cancel();
    expect(box.x).toBe('0');
  });
});
