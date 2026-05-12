/**
 * Tests for `applyOpsTo` + `dispatchApplyBatch` — the fallback batch
 * applier used by every action hook when the consumer's adapter omits
 * an explicit `applyOps`. The dispatch logic is short but appears in
 * every action surface; a regression here corrupts every undoable action.
 */
import { describe, it, expect, vi } from 'vitest';
import { applyOpsTo, dispatchApplyBatch } from './applyOps';
import type { Op } from './ops/types';

const noOp = (): Op => ({
  apply: vi.fn(),
  invert() { return this; },
});

describe('applyOpsTo', () => {
  it('invokes apply() on each op in order with the same adapter', () => {
    const adapter = { tag: 'mockAdapter' };
    const ops = [noOp(), noOp(), noOp()];
    applyOpsTo(adapter, ops);
    for (const op of ops) {
      expect(op.apply).toHaveBeenCalledOnce();
      expect(op.apply).toHaveBeenCalledWith(adapter);
    }
  });

  it('preserves apply order across calls', () => {
    const order: number[] = [];
    const ops: Op[] = [0, 1, 2].map((i) => ({
      apply: () => order.push(i),
      invert() { return this; },
    }));
    applyOpsTo({}, ops);
    expect(order).toEqual([0, 1, 2]);
  });

  it('ignores the label arg (it is informational only)', () => {
    const ops = [noOp()];
    applyOpsTo({}, ops, 'someLabel');
    expect(ops[0].apply).toHaveBeenCalledOnce();
  });

  it('empty ops array is a no-op', () => {
    expect(() => applyOpsTo({}, [])).not.toThrow();
  });
});

describe('dispatchApplyBatch', () => {
  it('forwards to adapter.applyOps when present, with ops and label', () => {
    const applyOps = vi.fn();
    const adapter = { applyOps };
    const ops = [noOp(), noOp()];
    dispatchApplyBatch(adapter, ops, 'Move');
    expect(applyOps).toHaveBeenCalledOnce();
    expect(applyOps).toHaveBeenCalledWith(ops, 'Move');
    // No direct op.apply should fire — the adapter is responsible.
    expect(ops[0].apply).not.toHaveBeenCalled();
  });

  it('falls back to direct application when adapter.applyOps is absent', () => {
    const adapter = {};
    const ops = [noOp(), noOp()];
    dispatchApplyBatch(adapter, ops);
    for (const op of ops) {
      expect(op.apply).toHaveBeenCalledOnce();
      expect(op.apply).toHaveBeenCalledWith(adapter);
    }
  });

  it('label is optional', () => {
    const applyOps = vi.fn();
    dispatchApplyBatch({ applyOps }, [noOp()]);
    expect(applyOps).toHaveBeenCalledWith(expect.any(Array), undefined);
  });
});
