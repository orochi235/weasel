import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { createLabStore } from '../state/store';
import { useTrialSnapshot } from './useTrialSnapshot';

const counter: Instrument = {
  name: 'Counter',
  initialState: () => ({ n: 0 }),
  render: () => null,
};

describe('useTrialSnapshot', () => {
  it('starts a history that rebuilds its own entries on a restore, as a restored one does', () => {
    const store = createLabStore({ instruments: [counter] });
    store
      .getState()
      .addTrial({ id: 't', instrumentName: 'Counter', config: {}, state: { n: 0 }, view: null });
    const { result } = renderHook(() =>
      useTrialSnapshot({
        store,
        trialId: 't',
        instrument: counter,
        ownHistory: () => null,
        onUndone: () => undefined,
      }),
    );
    act(() => {
      expect(result.current.snapshot('state.change')).toBe(true);
    });
    const history = store.getState().trials[0]?.history;
    if (!history) throw new Error('no history');
    history.restore(history.serialize());
    expect(history.canUndo()).toBe(true);
  });
});
