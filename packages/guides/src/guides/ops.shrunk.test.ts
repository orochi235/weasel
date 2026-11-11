import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createHistory } from '@weasel-js/history';
import { removeGuideOp, replaceGuideOp } from './ops';
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

  it('undoing a move over an id the store did not hold removes the guide, and a jump back leaves the list empty', () => {
    // Undo put `from` back, so a guide stood where none had.
    const { store, history, list } = setup();
    const g = { id: 'a', axis: 'x' as const, offset: 0 };
    act(() => { history.apply(replaceGuideOp(store, { ...g, offset: 1 }, g)); });
    act(() => { history.goto(0); });
    expect(list()).toEqual([]);
  });

  it('undoing a move puts back the guide the store held, not a stale `from`', () => {
    const { store, history, list } = setup();
    act(() => { store.addGuide({ id: 'g', axis: 'y', offset: 5 }); });
    act(() => { history.apply(replaceGuideOp(store, { id: 'g', axis: 'y', offset: 6 }, { id: 'g', axis: 'y', offset: 9 })); });
    act(() => { history.undo(); });
    expect(list()).toEqual([{ id: 'g', axis: 'y', offset: 5 }]);
  });
});
