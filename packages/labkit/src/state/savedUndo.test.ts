import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { trialEditOf } from '../trial/trialEditOp';
import { trialUndoHistory } from '../trial/useRestoredHistory';
import { serializeTrials } from './helpers';
import { createLabStore } from './store';

const counter: Instrument = {
  name: 'Counter',
  defaultConfig: () => ({}),
  initialState: () => ({ n: 0 }),
  render: () => null,
};

function storeWithTrial() {
  const store = createLabStore({ instruments: [counter] });
  store.getState().addTrial({
    id: 't',
    instrumentName: 'Counter',
    config: {},
    state: { n: 0 },
    view: null,
  });
  return store;
}

const record = (store: ReturnType<typeof storeWithTrial>) => {
  const found = store.getState().trials[0];
  if (!found) throw new Error('no trial');
  return found;
};

describe("a trial's saved history", () => {
  it('keeps only the steps after the newest one it cannot save', () => {
    const store = storeWithTrial();
    const history = trialUndoHistory(50);
    store.getState().setTrialHistory('t', history);
    history.recordEntry([trialEditOf(record(store), 'edit', store)], 'state.change');
    history.recordEntry([trialEditOf(record(store), 'edit', store)], 'state.change');
    history.recordEntry(
      [{ apply: () => {}, invert: () => ({ apply: () => {}, invert: () => ({}) as never }) }],
      'over',
    );
    history.recordEntry([trialEditOf(record(store), 'edit', store)], 'state.change');
    const [saved] = serializeTrials(store.getState().trials, {});
    expect(saved?.undo?.trial?.undoStack).toHaveLength(1);
    expect(saved?.undo?.trial?.droppedEntries).toBe(3);
  });

  it('is left out while there is nothing to undo or redo', () => {
    const store = storeWithTrial();
    store.getState().setTrialHistory('t', trialUndoHistory(50));
    const [saved] = serializeTrials(store.getState().trials, {});
    expect(saved).not.toHaveProperty('undo');
  });
});
