import { describe, expect, it } from 'vitest';
import type { Instrument, InstrumentList } from '../instrument/types';
import { createMemoryAdapter } from '../state/adapters';
import { openStoredLab, openUnstoredLab, presentStorageKey } from './openLab';

const counter: Instrument<{ count: number }, { n: number }> = {
  name: 'Counter',
  defaultConfig: () => ({ n: 1 }),
  initialState: (config) => ({ count: config.n * 10 }),
  render: () => null,
};
const other: Instrument<{ k: string }, { k: string }> = {
  name: 'Other',
  defaultConfig: () => ({ k: 'a' }),
  initialState: (config) => ({ k: config.k }),
  render: () => null,
};
const instruments = [counter, other] as unknown as InstrumentList;
const base = { instruments, defaultInstrument: 'Counter' };

describe('presentStorageKey', () => {
  it('keeps a presented lab apart from the full one', () => {
    expect(presentStorageKey('rosee')).toBe('rosee:present');
  });
});

describe('opening a presented lab', () => {
  it('opens one trial on the seed', () => {
    const { store } = openUnstoredLab(base, {
      instrument: 'Other',
      config: { k: 'b' },
    });
    const trials = store.getState().trials;
    expect(trials).toHaveLength(1);
    expect(trials[0]).toMatchObject({
      instrumentName: 'Other',
      config: { k: 'b' },
      state: { k: 'b' },
    });
  });

  it('takes a seeded state and view over the ones the config would give', () => {
    const { store } = openUnstoredLab(base, { config: { n: 2 }, state: { count: 7 }, view: 'v' });
    expect(store.getState().trials[0]).toMatchObject({
      instrumentName: 'Counter',
      config: { n: 2 },
      state: { count: 7 },
      view: 'v',
    });
  });

  it("keeps a returning visitor's trial while the seed is unchanged", async () => {
    const storage = createMemoryAdapter();
    const seed = { config: { n: 2 } };
    const first = await openStoredLab(base, 'lab', storage, seed);
    const id = first.store.getState().trials[0]?.id;
    first.store.getState().updateTrialState(id as string, { count: 99 });
    await first.close();

    const second = await openStoredLab(base, 'lab', storage, { config: { n: 2 } });
    expect(second.store.getState().trials).toHaveLength(1);
    expect(second.store.getState().trials[0]).toMatchObject({ id, state: { count: 99 } });
    await second.close();
  });

  it('reopens the trial on a seed that changed', async () => {
    const storage = createMemoryAdapter();
    const first = await openStoredLab(base, 'lab', storage, { config: { n: 2 } });
    await first.close();

    const second = await openStoredLab(base, 'lab', storage, { config: { n: 3 } });
    const trials = second.store.getState().trials;
    expect(trials).toHaveLength(1);
    expect(trials[0]).toMatchObject({ config: { n: 3 }, state: { count: 30 } });
    await second.close();

    const third = await openStoredLab(base, 'lab', storage, { config: { n: 3 } });
    expect(third.store.getState().trials[0]?.id).toBe(trials[0]?.id);
    await third.close();
  });
});
