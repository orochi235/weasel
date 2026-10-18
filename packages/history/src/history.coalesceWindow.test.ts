import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

interface Box { v: number }

function setOp(from: number, to: number): Op {
  return {
    name: 'test:set',
    args: { from, to },
    coalesceKey: 'v',
    apply(a: Box) { a.v = to; },
    invert: () => setOp(to, from),
  } as Op;
}

/** A history whose window is whatever `windowMs` holds at each push. */
function open(windowMs: number) {
  let t = 0;
  const live = { windowMs };
  const history = createHistory({ v: 0 }, { coalesceWindowMs: () => live.windowMs, now: () => t });
  return { history, live, tick: (ms: number) => { t += ms; } };
}

describe('coalesceWindowMs as a function', () => {
  it('reads the window at each push, so a change after creation applies to the next one', () => {
    const { history, live, tick } = open(100);
    history.applyOps([setOp(0, 1)], 'set');
    tick(50);
    history.applyOps([setOp(1, 2)], 'set');
    expect(history.undoDepth()).toBe(1);
    live.windowMs = 10;
    tick(50);
    history.applyOps([setOp(2, 3)], 'set');
    expect(history.undoDepth()).toBe(2);
  });

  it('hands the live window to a journal it begins', () => {
    const { history, live, tick } = open(0);
    const journal = history.beginJournal({ label: 'session' });
    live.windowMs = 100;
    journal.applyBatch([setOp(0, 1)], 'set');
    tick(50);
    journal.applyBatch([setOp(1, 2)], 'set');
    expect(journal.entries().undo).toHaveLength(1);
  });
});
