/** Shrunk counterexamples from `trialWrites.pbt.test.ts`, kept as plain examples. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { unruledConfigSchema } from '../instrument/serializers';
import { createLabStore } from '../state/store';
import { addTrial } from './trialOps';
import { useTrialWrites } from './useTrialWrites';

const instrument = defineInstrument({
  name: 'Model',
  config: f.schema({ a: f.number(0) }),
  initialState: (config) => ({ a: config.a }),
  undo: {},
  onConfigChange: (config) => ({ a: config.a }),
  render: () => null,
});

function open() {
  const store = createLabStore({ instruments: [instrument] });
  store.setState({ trials: addTrial([], [instrument], 'Model') });
  const trialId = store.getState().trials[0]?.id ?? '';
  const schema = unruledConfigSchema(instrument);
  if (!schema) throw new Error('the instrument declares a schema');
  const { result } = renderHook(() => useTrialWrites({ store, trialId, instrument, schema }));
  const history = () => store.getState().trials[0]?.history;
  return { store, write: (v: number) => act(() => result.current.setConfig('a', v)), history };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a trial config write', () => {
  it('of the value the path holds records no step', () => {
    const { store, write, history } = open();
    const before = store.getState().trials[0];
    write(0);
    expect(store.getState().trials[0]).toBe(before);
    expect(history()?.undoDepth() ?? 0).toBe(0);
  });

  it('in a drag that ends where it began leaves no step', () => {
    const { write, history } = open();
    write(1);
    vi.setSystemTime(1_000_040);
    write(0);
    expect(history()?.undoDepth() ?? 0).toBe(0);
    expect(history()?.redoDepth() ?? 0).toBe(0);
    vi.setSystemTime(1_000_080);
    write(2);
    expect(history()?.undoDepth()).toBe(1);
  });
});
