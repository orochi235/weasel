import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import type { TrialHistorySource } from '../trial/trialHistory';
import { cloneTrial } from '../trial/trialOps';
import { serializeTrials } from './helpers';
import { holdOwnUndo, ownUndoOf } from './ownUndo';
import { createLabStore } from './store';

const counter: Instrument = {
  name: 'Counter',
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

const source: TrialHistorySource = {
  canUndo: () => true,
  canRedo: () => false,
  undo: () => {},
  redo: () => {},
  subscribe: () => () => {},
  record: () => {},
  serialize: () => ({ steps: 3 }),
};

const saved = (store: ReturnType<typeof storeWithTrial>) =>
  serializeTrials(store.getState().trials, {}, (id) => ownUndoOf(store, id))[0];

describe("an instrument history's last saved form, kept once it unmounts", () => {
  it('is what the next save writes', () => {
    const store = storeWithTrial();
    holdOwnUndo(store, 't', source)();
    expect(saved(store)?.undo).toEqual({ own: { steps: 3 } });
  });

  it('is dropped by a Reset, so the next save writes no stack', () => {
    const store = storeWithTrial();
    holdOwnUndo(store, 't', source)();
    store.getState().resetTrial('t', [counter]);
    expect(ownUndoOf(store, 't')).toBeUndefined();
    expect(saved(store)).not.toHaveProperty('undo');
  });

  it('is dropped by a snapshot loaded over the trial', () => {
    const store = storeWithTrial();
    store.getState().saveSnapshot('t', 'first');
    holdOwnUndo(store, 't', source)();
    store.getState().loadSnapshot(store.getState().savedSnapshots[0]?.id ?? '', 't');
    expect(saved(store)).not.toHaveProperty('undo');
  });

  it('does not follow the trial into a clone', () => {
    const store = storeWithTrial();
    holdOwnUndo(store, 't', source)();
    const [, copy] = serializeTrials(cloneTrial(store.getState().trials, 't'), {}, (id) =>
      ownUndoOf(store, id),
    );
    expect(copy).not.toHaveProperty('undo');
  });

  it('is not kept for a trial closed before its history unmounted', () => {
    const store = storeWithTrial();
    const release = holdOwnUndo(store, 't', source);
    store.getState().removeTrial('t');
    release();
    expect(ownUndoOf(store, 't')).toBeUndefined();
  });
});
