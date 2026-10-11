import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

/** An op that sets `cell.v`, and one an owner appends to every edit in case
 *  it is needed: it does something only when `armed`. */
function fixture() {
  const cell = { v: 0, settled: 0 };
  const set = (from: number, to: number): Op => ({
    coalesceKey: 'set',
    apply: () => { cell.v = to; },
    invert: () => set(to, from),
  });
  const settle = (armed: boolean): Op => ({
    coalesceKey: 'settle',
    elideNoop: true,
    apply: () => {
      if (!armed) return 'noop';
      cell.settled++;
      return undefined;
    },
    invert: () => settle(armed),
  });
  return { cell, set, settle };
}

describe('an op marked elideNoop', () => {
  it('is left out of the entry when it reports a no-op', () => {
    const { set, settle } = fixture();
    const history = createHistory(null);
    history.applyOps([set(0, 1), settle(false)], 'edit');
    expect(history.allForwardOps()).toHaveLength(1);
  });

  it('stays in the entry when it did something', () => {
    const { set, settle } = fixture();
    const history = createHistory(null);
    history.applyOps([set(0, 1), settle(true)], 'edit');
    expect(history.allForwardOps()).toHaveLength(2);
  });

  it('does not stop two edits coalescing', () => {
    const { cell, set, settle } = fixture();
    const history = createHistory(null, { coalesceWindowMs: 1000 });
    history.applyOps([set(0, 1)], 'drag');
    history.applyOps([set(1, 2), settle(false)], 'drag');
    expect(history.entries().undo).toHaveLength(1);
    history.undo();
    expect(cell.v).toBe(0);
  });

  it('leaves an unmarked no-op in its entry', () => {
    const { set } = fixture();
    const history = createHistory(null);
    const idle: Op = { apply: () => 'noop', invert: () => idle };
    history.applyOps([set(0, 1), idle], 'edit');
    expect(history.allForwardOps()).toHaveLength(2);
  });
});
