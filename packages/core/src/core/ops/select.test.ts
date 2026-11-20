import { describe, expect, it } from 'vitest';
import { createSetSelectionOp } from './select';
import { asNodeId } from '../scene/types';

describe('createSetSelectionOp', () => {
  function makeAdapter() {
    const calls: string[][] = [];
    return {
      setSelection: (ids: string[]) => calls.push([...ids]),
      calls,
    };
  }

  it('apply sets the new selection', () => {
    const adapter = makeAdapter();
    createSetSelectionOp({ from: [asNodeId('a')], to: [asNodeId('b'), asNodeId('c')] }).apply(adapter as any);
    expect(adapter.calls).toEqual([['b', 'c']]);
  });

  it('invert swaps from and to', () => {
    const adapter = makeAdapter();
    createSetSelectionOp({ from: [asNodeId('a')], to: [asNodeId('b'), asNodeId('c')] }).invert().apply(adapter as any);
    expect(adapter.calls).toEqual([['a']]);
  });
});

describe('createSetSelectionOp: the live selection decides the no-op', () => {
  it('reports a change when a stale `from` equals `to` but the selection differs', () => {
    const op = createSetSelectionOp({ from: ['a'], to: ['a'] });
    expect(op.apply({ setSelection: () => {}, getSelection: () => ['b'] })).toBeUndefined();
  });

  it('reports a no-op when the selection is already `to`', () => {
    const op = createSetSelectionOp({ from: ['b'], to: ['a'] });
    expect(op.apply({ setSelection: () => {}, getSelection: () => ['a'] })).toBe(false);
  });

  it('falls back to `from` without a getSelection', () => {
    expect(createSetSelectionOp({ from: ['a'], to: ['a'] }).apply({ setSelection: () => {} })).toBe(false);
  });
});
