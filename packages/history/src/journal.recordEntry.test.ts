import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

function setOp(cell: { v: number }, from: number, to: number): Op {
  return { apply: () => { cell.v = to; }, invert: () => setOp(cell, to, from) };
}

describe('Journal.recordEntry', () => {
  it('records already-applied ops in the journal, undone inside it and landing in its commit', () => {
    const cell = { v: 0 };
    const parent = createHistory(null);
    const j = parent.beginJournal({ label: 'mode' });
    cell.v = 1;
    j.recordEntry([setOp(cell, 0, 1)], 'Set');
    expect(cell.v).toBe(1);
    expect(parent.canUndo()).toBe(false);
    j.undo();
    expect(cell.v).toBe(0);
    j.redo();
    j.commit('Mode');
    parent.undo();
    expect(cell.v).toBe(0);
  });

  it('folds a run under one coalesceKey into one journal entry', () => {
    const cell = { v: 0 };
    const j = createHistory(null).beginJournal({ label: 'mode' });
    cell.v = 1;
    j.recordEntry([setOp(cell, 0, 1)], 'Drag', { coalesceKey: 'k' });
    cell.v = 2;
    j.recordEntry([setOp(cell, 1, 2)], 'Drag', { coalesceKey: 'k' });
    expect(j.entries().undo).toHaveLength(1);
    j.undo();
    expect(cell.v).toBe(0);
  });

  it('throws once the journal is not active', () => {
    const j = createHistory(null).beginJournal({ label: 'mode' });
    j.suspend();
    expect(() => j.recordEntry([setOp({ v: 0 }, 0, 1)], 'Set')).toThrow('not active');
  });
});
