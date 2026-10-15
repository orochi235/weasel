import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

function setOp(target: { v: number }, from: number, to: number): Op {
  return {
    name: 'set',
    args: { from, to },
    apply() { target.v = to; },
    invert: () => setOp(target, to, from),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('a throwing subscriber', () => {
  it('does not stop the rest of a history notify, nor reach the caller', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = { v: 0 };
    const h = createHistory(t);
    const after = vi.fn();
    h.subscribe(() => { throw new Error('boom'); });
    h.subscribe(after);
    expect(() => h.applyOps([setOp(t, 0, 1)], 'a')).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(h.canUndo()).toBe(true);
    expect(error).toHaveBeenCalled();
  });

  it('does not stop the rest of a journal notify, nor reach the caller', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = { v: 0 };
    const j = createHistory(t).beginJournal({ label: 's' });
    const after = vi.fn();
    j.subscribe(() => { throw new Error('boom'); });
    j.subscribe(after);
    expect(() => j.applyBatch([setOp(t, 0, 1)], 'a')).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
  });
});
