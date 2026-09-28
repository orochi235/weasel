import { describe, it, expect, vi } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

function setOp(target: { v: number }, from: number, to: number, key?: string): Op {
  return {
    name: 'set',
    args: { from, to },
    ...(key ? { coalesceKey: key } : {}),
    apply() { target.v = to; },
    invert: () => setOp(target, to, from, key),
  };
}

describe('Journal subscribe / getVersion', () => {
  it('notifies and bumps on apply, undo and redo', () => {
    const t = { v: 0 };
    const j = createHistory(t).beginJournal({ label: 's' });
    const listener = vi.fn();
    j.subscribe(listener);
    const v0 = j.getVersion();
    j.applyBatch([setOp(t, 0, 1)], 'a');
    j.undo();
    j.redo();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(j.getVersion()).toBeGreaterThan(v0);
  });

  it('notifies on every lifecycle transition, since isActive changes', () => {
    const t = { v: 0 };
    const h = createHistory(t);
    const j = h.beginJournal({ label: 's' });
    const seen: boolean[] = [];
    j.subscribe(() => seen.push(j.isActive()));
    j.suspend();
    h.resumeJournal(j);
    j.commit('s');
    expect(seen).toEqual([false, true, false]);
  });

  it('stops notifying after unsubscribe', () => {
    const t = { v: 0 };
    const j = createHistory(t).beginJournal({ label: 's' });
    const listener = vi.fn();
    j.subscribe(listener)();
    j.applyBatch([setOp(t, 0, 1)], 'a');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('Journal coalescing', () => {
  it("inherits the parent's coalesce window and clock", () => {
    const t = { v: 0 };
    let clock = 0;
    const j = createHistory(t, { coalesceWindowMs: 500, now: () => clock }).beginJournal({ label: 's' });
    j.applyBatch([setOp(t, 0, 1, 'k')], 'type');
    clock = 100;
    j.applyBatch([setOp(t, 1, 2, 'k')], 'type');
    clock = 900;
    j.applyBatch([setOp(t, 2, 3, 'k')], 'type');
    expect(j.entries().undo.map((e) => e.pushes)).toEqual([2, 1]);
    j.undo();
    j.undo();
    expect(t.v).toBe(0);
  });

  it('takes its own window over the parent\'s', () => {
    const t = { v: 0 };
    let clock = 0;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    const j = h.beginJournal({ label: 's', coalesceWindowMs: 0 });
    j.applyBatch([setOp(t, 0, 1, 'k')], 'type');
    clock = 100;
    j.applyBatch([setOp(t, 1, 2, 'k')], 'type');
    expect(j.entries().undo).toHaveLength(2);
  });

  it('seal ends the run inside the journal', () => {
    const t = { v: 0 };
    const j = createHistory(t, { coalesceWindowMs: 500, now: () => 0 }).beginJournal({ label: 's' });
    j.applyBatch([setOp(t, 0, 1, 'k')], 'type');
    j.seal();
    j.applyBatch([setOp(t, 1, 2, 'k')], 'type');
    expect(j.entries().undo).toHaveLength(2);
  });
});
