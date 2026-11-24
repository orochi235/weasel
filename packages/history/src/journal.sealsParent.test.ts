import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

interface Box { v: number }

function setOp(from: number, to: number): Op {
  return { coalesceKey: 'v', apply(a: Box) { a.v = to; }, invert: () => setOp(to, from) };
}

describe('a suspended journal', () => {
  it('ends the parent coalescing run its edits landed on', () => {
    const box: Box = { v: 0 };
    const parent = createHistory(box, { coalesceWindowMs: 500, now: () => 0 });
    parent.applyOps([setOp(0, 1)], 'Move');
    const j = parent.beginJournal({ label: 'session' });
    j.applyOps([setOp(1, 2)], 'Move');
    j.suspend();
    parent.applyOps([setOp(2, 3)], 'Move');

    expect(parent.undoDepth()).toBe(2);
    parent.undo();
    expect(box.v).toBe(2);
  });

  it('ends the run in the journal it was opened inside', () => {
    const box: Box = { v: 0 };
    const parent = createHistory(box, { coalesceWindowMs: 500, now: () => 0 });
    const outer = parent.beginJournal({ label: 'outer' });
    outer.applyOps([setOp(0, 1)], 'Move');
    const inner = outer.beginJournal({ label: 'inner' });
    inner.applyOps([setOp(1, 2)], 'Move');
    inner.suspend();
    outer.applyOps([setOp(2, 3)], 'Move');

    expect(outer.entries().undo).toHaveLength(2);
  });
});
