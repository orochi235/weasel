import { describe, expect, it, vi } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

interface Cell { x: number }

/** Minimal invertible op over a shared cell. `key` opts into coalescing. */
function setX(cell: Cell, from: number, to: number, key?: string): Op {
  return {
    name: 'test:setX',
    args: { id: 'a', from, to },
    coalesceKey: key,
    apply: () => { cell.x = to; },
    invert: () => setX(cell, to, from, key),
  };
}

describe('historyLimit', () => {
  it('evicts the oldest entry when a push overflows the cap', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, { historyLimit: 2 });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.applyOps([setX(cell, 2, 3)], 'three');
    expect(history.entries().undo.map((e) => e.label)).toEqual(['two', 'three']);
    history.undo();
    history.undo();
    expect(history.canUndo()).toBe(false);
    // The evicted 'one' can no longer be undone: state rests at its to-state.
    expect(cell.x).toBe(1);
  });

  it('recordEntry also enforces the cap', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, { historyLimit: 1 });
    history.recordEntry([setX(cell, 0, 1)], 'one');
    history.recordEntry([setX(cell, 1, 2)], 'two');
    expect(history.entries().undo.map((e) => e.label)).toEqual(['two']);
  });

  it('clamps a negative historyLimit to 0 instead of hanging', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, { historyLimit: -1 });
    history.applyOps([setX(cell, 0, 1)], 'one'); // must terminate
    expect(history.canUndo()).toBe(false);
    expect(cell.x).toBe(1); // the op still applied; only the entry was evicted
  });

  it('coalescing does not evict (stack depth unchanged)', () => {
    const cell: Cell = { x: 0 };
    let t = 1000;
    const onEvict = vi.fn();
    const history = createHistory(null, {
      historyLimit: 2, coalesceWindowMs: 500, now: () => t, onEvict,
    });
    history.applyOps([setX(cell, 0, 1, 'x')], 'drag');
    t += 100;
    history.applyOps([setX(cell, 1, 2, 'x')], 'drag'); // merges
    t += 100;
    history.applyOps([setX(cell, 2, 3, 'x')], 'drag'); // merges
    expect(history.entries().undo).toHaveLength(1);
    expect(onEvict).not.toHaveBeenCalled();
  });
});

describe('onEvict', () => {
  it('fires with the evicted entry on historyLimit overflow', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { historyLimit: 1, onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    expect(onEvict).toHaveBeenCalledTimes(1);
    const entry = onEvict.mock.calls[0][0];
    expect(entry.label).toBe('one');
    expect(entry.forwardOps[0].name).toBe('test:setX');
  });

  it('fires for each redo entry dropped by a branch edit', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.applyOps([setX(cell, 2, 3)], 'three');
    history.undo();
    history.undo(); // redo stack now holds 'two' and 'three'
    history.applyOps([setX(cell, 1, 9)], 'branch');
    expect(onEvict).toHaveBeenCalledTimes(2);
    const labels = onEvict.mock.calls.map((c) => c[0].label).sort();
    expect(labels).toEqual(['three', 'two']);
  });

  it('fires on the coalesce path when the merge clears the redo stack', () => {
    const cell: Cell = { x: 0 };
    let t = 1000;
    const onEvict = vi.fn();
    const history = createHistory(null, { coalesceWindowMs: 500, now: () => t, onEvict });
    history.applyOps([setX(cell, 0, 1, 'x')], 'drag');
    history.applyOps([setX(cell, 1, 2)], 'other'); // no key — discrete
    history.undo();                                // redo: ['other']
    t += 100;
    history.applyOps([setX(cell, 1, 3, 'x')], 'drag'); // coalesces into 'drag'
    expect(history.entries().undo.map((e) => e.label)).toEqual(['drag']);
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict.mock.calls[0][0].label).toBe('other');
  });

  it('fires on recordEntry redo-clear and recordEntry overflow', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { historyLimit: 1, onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.undo();                                 // redo: ['one']
    history.recordEntry([setX(cell, 0, 2)], 'rec'); // drops 'one' from redo
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict.mock.calls[0][0].label).toBe('one');
    history.recordEntry([setX(cell, 2, 3)], 'rec2'); // overflow → evicts 'rec'
    expect(onEvict).toHaveBeenCalledTimes(2);
    expect(onEvict.mock.calls[1][0].label).toBe('rec');
  });

  it('does NOT fire on clear() or restore()', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn();
    const history = createHistory(null, { onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    const snap = history.serialize();
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.restore(snap); // wholesale replace — no per-entry eviction
    history.applyOps([setX(cell, 1, 5)], 'three');
    history.clear();       // wholesale drop — no per-entry eviction
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('a throwing onEvict does not desync the stacks or skip the cap', () => {
    const cell: Cell = { x: 0 };
    const onEvict = vi.fn(() => { throw new Error('boom'); });
    const history = createHistory(null, { historyLimit: 1, onEvict });
    history.applyOps([setX(cell, 0, 1)], 'one');
    expect(() => history.applyOps([setX(cell, 1, 2)], 'two')).not.toThrow();
    expect(history.entries().undo.map((e) => e.label)).toEqual(['two']); // cap still enforced
  });
});

describe('undoDepth / redoDepth', () => {
  it('reports stack depths matching entries() without materializing views', () => {
    const cell: Cell = { x: 0 };
    const history = createHistory(null, {});
    history.applyOps([setX(cell, 0, 1)], 'one');
    history.applyOps([setX(cell, 1, 2)], 'two');
    history.undo();
    expect(history.undoDepth()).toBe(1);
    expect(history.redoDepth()).toBe(1);
    expect(history.undoDepth()).toBe(history.entries().undo.length);
    expect(history.redoDepth()).toBe(history.entries().redo.length);
  });
});
