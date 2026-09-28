import { describe, it, expect } from 'vitest';
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

describe('HistoryEntry.pushes', () => {
  it('is 1 for an entry no push merged into', () => {
    const t = { v: 0 };
    const h = createHistory(t);
    h.applyOps([setOp(t, 0, 1)], 'a');
    h.recordEntry([setOp(t, 1, 2)], 'b');
    expect(h.entries().undo.map((e) => e.pushes)).toEqual([1, 1]);
  });

  it('counts every push a coalesce folded in', () => {
    const t = { v: 0 };
    let clock = 0;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    for (let i = 1; i <= 4; i++) {
      clock += 100;
      h.applyOps([setOp(t, i - 1, i, 'k')], 'nudge');
    }
    expect(h.entries().undo.map((e) => e.pushes)).toEqual([4]);
  });

  it('survives serialize and restore', () => {
    const t = { v: 0 };
    let clock = 0;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    h.applyOps([setOp(t, 0, 1, 'k')], 'nudge');
    clock = 100;
    h.applyOps([setOp(t, 1, 2, 'k')], 'nudge');
    const snap = h.serialize();
    expect(snap.undoStack[0].pushes).toBe(2);

    const h2 = createHistory(t, { rebuildOp: (_n, args) => {
      const a = args as { from: number; to: number };
      return setOp(t, a.from, a.to, 'k');
    } });
    h2.restore(snap);
    expect(h2.entries().undo[0].pushes).toBe(2);
    const { pushes: _drop, ...older } = snap.undoStack[0];
    h2.restore({ ...snap, undoStack: [older] });
    expect(h2.entries().undo[0].pushes).toBe(1);
  });
});
