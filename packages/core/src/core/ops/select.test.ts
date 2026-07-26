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
