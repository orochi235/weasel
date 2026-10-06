import { describe, expect, it, vi } from 'vitest';
import { createHistory, type CreateHistoryOptions } from './history';
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

/** Writes `to` to the cell as one entry, stamped at `at`. */
function setup(options: CreateHistoryOptions = {}) {
  const cell: Cell = { x: 0 };
  let t = 0;
  const history = createHistory(null, { now: () => t, branching: true, ...options });
  const write = (to: number, at: number) => {
    t = at;
    history.applyOps([setX(cell, cell.x, to)], `to ${to}`);
  };
  return { cell, history, write };
}

describe('branching off', () => {
  it('drops the redo future on a push, as before', () => {
    const { history, write } = setup({ branching: false });
    write(1, 10);
    write(2, 20);
    history.undo();
    write(3, 30);
    expect(history.branches()).toEqual([]);
    expect(history.redoDepth()).toBe(0);
  });
});

describe('branching on', () => {
  it('keeps the redo future as a branch when a push is made while rewound', () => {
    const onEvict = vi.fn();
    const { history, write } = setup({ onEvict });
    write(1, 10);
    write(2, 20);
    history.undo();
    write(3, 15);
    expect(onEvict).not.toHaveBeenCalled();
    expect(history.redoDepth()).toBe(0);
    history.undo();
    const branches = history.branches();
    expect(branches.map((b) => [b.label, b.length, b.current])).toEqual([
      ['to 2', 1, false],
      ['to 3', 1, true],
    ]);
  });

  it('switches to a branch and redoes along it', () => {
    const { cell, history, write } = setup();
    write(1, 10);
    write(2, 20);
    history.undo();
    write(3, 15);
    history.undo();
    const old = history.branches().find((b) => !b.current)!;
    history.switchBranch(old.id);
    expect(cell.x).toBe(1);
    expect(history.branches().map((b) => [b.label, b.current])).toEqual([
      ['to 2', true],
      ['to 3', false],
    ]);
    history.redo();
    expect(cell.x).toBe(2);
  });

  it('keeps the current branch in time order for depthAt', () => {
    const { cell, history, write } = setup();
    write(1, 10);
    write(2, 20);
    write(3, 30);
    history.goto(1);
    write(4, 12);
    write(5, 14);
    history.goto(history.depthAt(13));
    expect(cell.x).toBe(4);
    expect([0, 1, 2].map((i) => history.timestampAt(i))).toEqual([10, 12, 14]);
  });

  it('keeps a branch nested inside another across switches', () => {
    const { cell, history, write } = setup();
    write(1, 10);
    write(2, 20);
    write(3, 30);
    history.goto(2);
    write(4, 25); // forks at 'to 2': [to 3] kept
    history.goto(1);
    write(5, 15); // forks at 'to 1': [to 2, to 4] kept, with its own fork inside
    history.undo();
    history.switchBranch(history.branches().find((b) => b.label === 'to 2')!.id);
    history.redo();
    expect(history.branches().map((b) => b.label)).toEqual(['to 3', 'to 4']);
    history.switchBranch(history.branches().find((b) => b.label === 'to 3')!.id);
    history.redo();
    expect(cell.x).toBe(3);
  });

  it('lists only the current future where nothing forked', () => {
    const { history, write } = setup();
    write(1, 10);
    history.undo();
    expect(history.branches().map((b) => [b.label, b.current])).toEqual([['to 1', true]]);
  });

  it('throws on a branch that does not fork from here', () => {
    const { history, write } = setup();
    write(1, 10);
    expect(() => history.switchBranch(999)).toThrow();
  });

  it('notifies on a switch', () => {
    const { history, write } = setup();
    write(1, 10);
    history.undo();
    write(2, 15);
    history.undo();
    const listener = vi.fn();
    history.subscribe(listener);
    history.switchBranch(history.branches().find((b) => !b.current)!.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('evicts the branches under an entry historyLimit evicts', () => {
    const onEvict = vi.fn();
    const { history, write } = setup({ historyLimit: 2, onEvict });
    write(1, 10);
    write(2, 20);
    history.undo();
    write(3, 15); // 'to 2' kept as a branch under 'to 1'
    write(4, 30); // overflows: 'to 1' evicted, and its branch with it
    expect(onEvict.mock.calls.map(([e]) => e.label).sort()).toEqual(['to 1', 'to 2']);
  });

  it('evicts the branches under an entry prune evicts', () => {
    const onEvict = vi.fn();
    const { history, write } = setup({ onEvict });
    write(1, 10);
    write(2, 20);
    history.undo();
    write(3, 15);
    history.prune(12);
    expect(onEvict.mock.calls.map(([e]) => e.label).sort()).toEqual(['to 1', 'to 2']);
  });

  it('keeps branches forked from the very start', () => {
    const { history, write } = setup();
    write(1, 10);
    history.undo();
    write(2, 5);
    history.undo();
    expect(history.branches().map((b) => b.label)).toEqual(['to 1', 'to 2']);
  });

  it('round-trips branches through serialize and restore', () => {
    const { history, write } = setup();
    write(1, 10);
    write(2, 20);
    history.undo();
    write(3, 15);
    history.undo();
    const restored = createHistory(null, { branching: true, rebuildOp: () => ({ apply() {}, invert() { return this; } }) });
    restored.restore(history.serialize());
    expect(restored.branches().map((b) => [b.label, b.current])).toEqual([
      ['to 2', false],
      ['to 3', true],
    ]);
  });

  it('drops branches on clear', () => {
    const { history, write } = setup();
    write(1, 10);
    history.undo();
    write(2, 5);
    history.clear();
    expect(history.branches()).toEqual([]);
  });
});
