import { describe, expect, it, vi } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

interface Cell { x: number }

function setX(cell: Cell, from: number, to: number): Op {
  return {
    name: 'test:setX',
    args: { id: 'a', from, to },
    apply: () => { cell.x = to; },
    invert: () => setX(cell, to, from),
  };
}

/** A history on a settable clock, with entries stamped 10, 20 and 30. */
function stamped() {
  const cell: Cell = { x: 0 };
  let t = 0;
  const history = createHistory(null, { now: () => t });
  for (const at of [10, 20, 30]) {
    t = at;
    history.applyOps([setX(cell, cell.x, at)], `at ${at}`);
  }
  return { cell, history, setTime: (at: number) => { t = at; } };
}

describe('timestampAt', () => {
  it('reads entries in time order across the undo and redo stacks', () => {
    const { history } = stamped();
    history.undo();
    expect([0, 1, 2].map((i) => history.timestampAt(i))).toEqual([10, 20, 30]);
  });

  it('reads the next redo entry at undoDepth()', () => {
    const { history } = stamped();
    history.goto(1);
    expect(history.timestampAt(history.undoDepth())).toBe(20);
  });

  it('is undefined outside the entries', () => {
    const { history } = stamped();
    expect(history.timestampAt(-1)).toBeUndefined();
    expect(history.timestampAt(3)).toBeUndefined();
  });
});

describe('depthAt', () => {
  it('counts the entries stamped at or before a time', () => {
    const { history } = stamped();
    expect([0, 10, 15, 20, 30, 99].map((t) => history.depthAt(t))).toEqual([0, 1, 1, 2, 3, 3]);
  });

  it('answers the same from any position', () => {
    const { history } = stamped();
    history.goto(0);
    expect(history.depthAt(25)).toBe(2);
    history.goto(3);
    expect(history.depthAt(25)).toBe(2);
  });

  it('seeks backward and forward through goto', () => {
    const { cell, history } = stamped();
    history.goto(history.depthAt(15));
    expect(cell.x).toBe(10);
    history.goto(history.depthAt(30));
    expect(cell.x).toBe(30);
  });
});

describe('goto', () => {
  it('does not notify when already at the depth', () => {
    const { history } = stamped();
    const listener = vi.fn();
    history.subscribe(listener);
    const version = history.getVersion();
    history.goto(3);
    expect(listener).not.toHaveBeenCalled();
    expect(history.getVersion()).toBe(version);
  });
});

describe('serialized timestamps', () => {
  it('survive serialize and restore', () => {
    const { history } = stamped();
    history.undo();
    const restored = createHistory(null);
    restored.restore(history.serialize());
    expect([0, 1, 2].map((i) => restored.timestampAt(i))).toEqual([10, 20, 30]);
  });

  it('read as 0 from a snapshot that predates them', () => {
    const { history } = stamped();
    const snap = history.serialize();
    for (const e of snap.undoStack) delete e.timestamp;
    const restored = createHistory(null);
    restored.restore(snap);
    expect(restored.timestampAt(0)).toBe(0);
  });
});

describe('prune', () => {
  it('evicts undo entries stamped before a time, reporting each', () => {
    const onEvict = vi.fn();
    const cell: Cell = { x: 0 };
    let t = 0;
    const history = createHistory(null, { now: () => t, onEvict });
    for (const at of [10, 20, 30]) {
      t = at;
      history.applyOps([setX(cell, cell.x, at)], `at ${at}`);
    }
    history.prune(25);
    expect(onEvict.mock.calls.map(([e]) => e.label)).toEqual(['at 10', 'at 20']);
    expect(history.undoDepth()).toBe(1);
    expect(history.timestampAt(0)).toBe(30);
  });

  it('never drops a redo entry, however old', () => {
    const { history } = stamped();
    history.goto(0);
    history.prune(99);
    expect(history.redoDepth()).toBe(3);
  });

  it('notifies only when it evicted something', () => {
    const { history } = stamped();
    const listener = vi.fn();
    history.subscribe(listener);
    history.prune(5);
    expect(listener).not.toHaveBeenCalled();
    history.prune(15);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
