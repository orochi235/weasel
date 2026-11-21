import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { createLabStore } from '../state/store';
import { TRIAL_EDIT_OP, type TrialEditArgs, trialEditOf, trialEditOp } from './trialEditOp';
import { trialUndoHistory, useRestoredHistory } from './useRestoredHistory';

const counter: Instrument = {
  name: 'Counter',
  initialState: () => ({ n: 0 }),
  render: () => null,
};

/** A store whose trial `t` was read with one saved undo step. */
function storeReadWithHistory() {
  const store = createLabStore({ instruments: [counter] });
  store
    .getState()
    .addTrial({ id: 't', instrumentName: 'Counter', config: {}, state: { n: 0 }, view: null });
  const record = store.getState().trials[0];
  if (!record) throw new Error('no trial');
  const history = trialUndoHistory(50);
  history.recordEntry([trialEditOf(record, 'edit', store)], 'state.change');
  const trial = history.serialize();
  store.setState((s) => ({ trials: s.trials.map((t) => ({ ...t, undo: { trial } })) }));
  return store;
}

describe('useRestoredHistory', () => {
  it('restores a saved history once its instrument gains undo under the live trial', () => {
    const store = storeReadWithHistory();
    const rebuild = (name: string, args: unknown) =>
      name === TRIAL_EDIT_OP ? trialEditOp(args as TrialEditArgs, store, 't') : null;
    const { rerender } = renderHook(
      ({ enabled }) => useRestoredHistory({ store, trialId: 't', enabled, maxDepth: 50, rebuild }),
      { initialProps: { enabled: false } },
    );
    expect(store.getState().trials[0]?.history).toBeUndefined();
    rerender({ enabled: true });
    expect(store.getState().trials[0]?.history?.canUndo()).toBe(true);
  });
});
