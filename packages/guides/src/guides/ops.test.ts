import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createHistory } from '@weasel-js/history';
import { createAddGuideOp, createReplaceGuideOp } from './ops';
import { useGuides } from './useGuides';

function setup() {
  const { result } = renderHook(() => useGuides());
  return { store: result.current, history: createHistory(null) };
}

describe('guide ops that change nothing', () => {
  const g = { id: 'g', axis: 'x' as const, offset: 5, span: { min: 0, max: 10 } };

  it('adding a guide equal to the one held is no undo step', () => {
    const { store, history } = setup();
    act(() => { store.addGuide(g); });
    act(() => { history.apply(createAddGuideOp(store, { ...g, span: { ...g.span } })); });
    expect(history.canUndo()).toBe(false);
  });

  it('a move onto the guide already held is no undo step', () => {
    const { store, history } = setup();
    act(() => { store.addGuide(g); });
    act(() => { history.apply(createReplaceGuideOp(store, { ...g, offset: 1 }, { ...g })); });
    expect(history.canUndo()).toBe(false);
  });

  it('a move that changes only the span is an undo step', () => {
    const { store, history } = setup();
    act(() => { store.addGuide(g); });
    act(() => { history.apply(createReplaceGuideOp(store, g, { ...g, span: { min: 0, max: 20 } })); });
    expect(history.canUndo()).toBe(true);
  });
});
