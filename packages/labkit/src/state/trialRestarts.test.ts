import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { createLabStore } from './store';
import { onTrialRestart } from './trialRestarts';

const counter: Instrument = {
  name: 'Counter',
  defaultConfig: () => ({ step: 1 }),
  initialState: () => ({ n: 0 }),
  render: () => null,
};

function storeWithTrial() {
  const store = createLabStore({ instruments: [counter] });
  store.getState().addTrial({
    id: 't',
    instrumentName: 'Counter',
    config: { step: 1 },
    state: { n: 0 },
    view: null,
  });
  return store;
}

describe("the store's restart of a trial's undo", () => {
  it('is announced by resetTrial, to that trial only', () => {
    const store = storeWithTrial();
    const heard = vi.fn();
    const other = vi.fn();
    onTrialRestart(store, 't', heard);
    onTrialRestart(store, 'u', other);
    store.getState().updateTrialState('t', { n: 5 });
    store.getState().resetTrial('t', [counter]);
    expect(store.getState().trials[0]?.state).toEqual({ n: 0 });
    expect(heard).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
  });

  it('is announced by loadSnapshot, and not by one it refuses', () => {
    const store = storeWithTrial();
    const heard = vi.fn();
    const stop = onTrialRestart(store, 't', heard);
    store.getState().saveSnapshot('t', 'first');
    const id = store.getState().savedSnapshots[0]?.id ?? '';
    store.getState().loadSnapshot('missing', 't');
    expect(heard).not.toHaveBeenCalled();
    store.getState().loadSnapshot(id, 't');
    expect(heard).toHaveBeenCalledOnce();
    stop();
    store.getState().loadSnapshot(id, 't');
    expect(heard).toHaveBeenCalledOnce();
  });

  it('keeps a stop called twice from dropping a later listener', () => {
    const store = storeWithTrial();
    const stop = onTrialRestart(store, 't', () => {});
    stop();
    const later = vi.fn();
    onTrialRestart(store, 't', later);
    stop();
    store.getState().resetTrial('t', [counter]);
    expect(later).toHaveBeenCalledOnce();
  });

  it('keeps a listener that throws from stopping the rest', () => {
    const store = storeWithTrial();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    onTrialRestart(store, 't', () => {
      throw new Error('boom');
    });
    onTrialRestart(store, 't', after);
    store.getState().resetTrial('t', [counter]);
    expect(after).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
