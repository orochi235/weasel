import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createHistory } from '@weasel-js/history';
import { removeGuideOp } from './ops';
import { useGuides } from './useGuides';

function setup() {
  const { result } = renderHook(() => useGuides());
  return { store: result.current, history: createHistory(null), list: () => result.current.getGuides() };
}

describe('guide ops, shrunk from the property tests', () => {
  it('removing a guide the store does not hold is no undo step, and adds nothing back', () => {
    // Undo added the guide the op was handed, which had never been there.
    const { store, history, list } = setup();
    act(() => { history.apply(removeGuideOp(store, { id: 'a!', axis: 'y', offset: 3 })); });
    expect(history.canUndo()).toBe(false);
    act(() => { history.undo(); });
    expect(list()).toEqual([]);
  });

  it('undoing a removal puts back the guide the store held, not a stale copy the op was handed', () => {
    const { store, history, list } = setup();
    act(() => { store.addGuide({ id: 'g', axis: 'x', offset: 5 }); });
    act(() => { history.apply(removeGuideOp(store, { id: 'g', axis: 'x', offset: 1 })); });
    act(() => { history.undo(); });
    expect(list()).toEqual([{ id: 'g', axis: 'x', offset: 5 }]);
  });
});
