import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { createLabStore } from './store';
import { as2DView, DEFAULT_VIEW } from './view';

interface OrbitView {
  yaw: number;
  pitch: number;
  distance: number;
}

const orbit: OrbitView = { yaw: 1.1, pitch: 0.3, distance: 9 };

describe('as2DView', () => {
  it('accepts the 2D shape', () => {
    expect(as2DView({ zoom: 2, pan: { x: 1, y: 3 } })).toEqual({ zoom: 2, pan: { x: 1, y: 3 } });
  });

  it('copies rather than aliasing, so a caller cannot mutate the record', () => {
    const source = { zoom: 2, pan: { x: 1, y: 3 } };
    const out = as2DView(source);
    expect(out).not.toBe(source);
    expect(out?.pan).not.toBe(source.pan);
  });

  it('rejects an orbit view', () => {
    expect(as2DView(orbit)).toBeNull();
  });

  it('rejects a partial 2D view rather than filling in a default', () => {
    expect(as2DView({ zoom: 2 })).toBeNull();
    expect(as2DView({ zoom: 2, pan: { x: 1 } })).toBeNull();
  });

  it('rejects things that are not objects', () => {
    expect(as2DView(null)).toBeNull();
    expect(as2DView(undefined)).toBeNull();
    expect(as2DView(4)).toBeNull();
  });
});

describe('a trial view labkit does not interpret', () => {
  it('stores and returns a view shape that is not zoom/pan', () => {
    const store = createLabStore({ storageKey: 'view-a', storage: createMemoryAdapter() });
    store.getState().addTrial({
      id: 'w1',
      instrumentName: 'gem',
      config: {},
      state: {},
      view: DEFAULT_VIEW,
    });

    store.getState().updateTrialView('w1', orbit);

    expect(store.getState().trials[0]?.view as OrbitView).toEqual(orbit);
  });

  it('round-trips that view through persistence', () => {
    vi.useFakeTimers();
    const mem = createMemoryAdapter();
    const seed = createLabStore({ storageKey: 'view-b', storage: mem });
    seed.getState().addTrial({
      id: 'w1',
      instrumentName: 'gem',
      config: {},
      state: {},
      view: orbit,
    });
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    const hydrated = createLabStore({ storageKey: 'view-b', storage: mem });
    expect(hydrated.getState().trials[0]?.view as OrbitView).toEqual(orbit);
  });
});

describe('an unchanged write costs no new record', () => {
  it('returns the same trial object when setState returns its input', () => {
    const store = createLabStore({ storageKey: 'identity-a', storage: createMemoryAdapter() });
    store.getState().addTrial({
      id: 'w1',
      instrumentName: 'gem',
      config: {},
      state: { n: 1 },
      view: DEFAULT_VIEW,
    });
    const before = store.getState().trials[0];

    store.getState().updateTrialState('w1', (prev: unknown) => prev);

    // A trial re-renders on record identity, so allocating here would turn the
    // standard React bail-out into a render loop.
    expect(store.getState().trials[0]).toBe(before);
  });

  it('still replaces the record when the state actually changes', () => {
    const store = createLabStore({ storageKey: 'identity-b', storage: createMemoryAdapter() });
    store.getState().addTrial({
      id: 'w1',
      instrumentName: 'gem',
      config: {},
      state: { n: 1 },
      view: DEFAULT_VIEW,
    });
    const before = store.getState().trials[0];

    store.getState().updateTrialState('w1', { n: 2 });

    expect(store.getState().trials[0]).not.toBe(before);
  });

  it('returns the same trial object when the view is written unchanged', () => {
    const store = createLabStore({ storageKey: 'identity-c', storage: createMemoryAdapter() });
    store.getState().addTrial({
      id: 'w1',
      instrumentName: 'gem',
      config: {},
      state: {},
      view: orbit,
    });
    const before = store.getState().trials[0];

    store.getState().updateTrialView('w1', orbit);

    expect(store.getState().trials[0]).toBe(before);
  });
});
