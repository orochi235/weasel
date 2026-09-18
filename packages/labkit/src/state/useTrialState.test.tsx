import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { auto } from '../config/auto';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import type { Instrument } from '../instrument/types';
import { LabStoreProvider, TrialIdProvider } from './context';
import { createLabStore } from './store';
import { useTrialState } from './useTrialState';

type TestState = { count: number };
type TestConfig = { step: number };

function makeWrapper(trialId: string) {
  const store = createLabStore();
  store.getState().addTrial({
    id: trialId,
    instrumentName: 'Counter',
    config: { step: 1 } satisfies TestConfig,
    state: { count: 0 } satisfies TestState,
    view: { zoom: 1, pan: { x: 0, y: 0 } },
  });

  return {
    store,
    wrapper: ({ children }: { children: ReactNode }) => (
      <LabStoreProvider store={store}>
        <TrialIdProvider trialId={trialId}>{children}</TrialIdProvider>
      </LabStoreProvider>
    ),
  };
}

describe('useTrialState', () => {
  it('returns the initial state and config', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useTrialState<TestState, TestConfig>(), { wrapper });
    expect(result.current.state.count).toBe(0);
    expect(result.current.config.step).toBe(1);
  });

  it('setState (plain value) updates the store', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useTrialState<TestState, TestConfig>(), { wrapper });
    act(() => result.current.setState({ count: 42 }));
    expect(result.current.state.count).toBe(42);
  });

  it('setState (updater) updates the store', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useTrialState<TestState, TestConfig>(), { wrapper });
    act(() => result.current.setState((prev) => ({ count: prev.count + 10 })));
    expect(result.current.state.count).toBe(10);
  });

  it('setConfig updates a config key', () => {
    const { wrapper } = makeWrapper('w1');
    const { result } = renderHook(() => useTrialState<TestState, TestConfig>(), { wrapper });
    act(() => result.current.setConfig('step', 5));
    expect(result.current.config.step).toBe(5);
  });

  it('sibling trial does not re-render on unrelated trial changes', () => {
    const store = createLabStore();
    store.getState().addTrial({
      id: 'w1',
      instrumentName: 'T',
      config: {},
      state: { n: 0 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    store.getState().addTrial({
      id: 'w2',
      instrumentName: 'T',
      config: {},
      state: { n: 0 },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });

    let w2RenderCount = 0;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <LabStoreProvider store={store}>
        <TrialIdProvider trialId="w2">{children}</TrialIdProvider>
      </LabStoreProvider>
    );

    renderHook(
      () => {
        w2RenderCount++;
        return useTrialState();
      },
      { wrapper },
    );

    const countBefore = w2RenderCount;
    act(() => store.getState().updateTrialState('w1', { n: 99 }));
    expect(w2RenderCount).toBe(countBefore);
  });

  it('throws when used outside LabStoreProvider', () => {
    expect(() => renderHook(() => useTrialState())).toThrow('[labkit]');
  });
});

const autoInstrument = defineInstrument({
  name: 'Auto',
  config: f.schema({
    width: f.number(432),
    gap: f.number(12).auto((c) => (c.width as number) / 24),
  }),
  initialState: () => ({ count: 0 }),
  render: () => null,
});

function makeAutoWrapper(trialId: string) {
  const store = createLabStore({ instruments: [autoInstrument as Instrument] });
  store.getState().addTrial({
    id: trialId,
    instrumentName: 'Auto',
    config: autoInstrument.defaultConfig(),
    state: { count: 0 },
    view: { zoom: 1, pan: { x: 0, y: 0 } },
  });
  return {
    store,
    wrapper: ({ children }: { children: ReactNode }) => (
      <LabStoreProvider store={store}>
        <TrialIdProvider trialId={trialId}>{children}</TrialIdProvider>
      </LabStoreProvider>
    ),
  };
}

describe('auto paths', () => {
  it('hands the instrument the resolved config and the raw one separately', () => {
    const { store, wrapper } = makeAutoWrapper('w1');
    const { result } = renderHook(
      () => useTrialState<{ count: number }, { width: number; gap: number }>(),
      { wrapper },
    );
    act(() => store.getState().updateTrialConfig('w1', 'gap', auto));
    expect(result.current.config.gap).toBe(18);
    expect(result.current.raw.gap).toBe(12);
    expect([...result.current.auto]).toEqual(['gap']);
  });

  it('leaves a pinned config untouched', () => {
    const { wrapper } = makeAutoWrapper('w1');
    const { result } = renderHook(
      () => useTrialState<{ count: number }, { width: number; gap: number }>(),
      { wrapper },
    );
    expect(result.current.config.gap).toBe(12);
    expect(result.current.config).toBe(result.current.raw);
    expect([...result.current.auto]).toEqual([]);
  });

  it('records a path written as auto instead of storing the sentinel', () => {
    const { store } = makeWrapper('w1');
    store.getState().updateTrialConfig('w1', 'gap', 24);
    store.getState().updateTrialConfig('w1', 'gap', auto);
    const rec = store.getState().trials[0];
    expect(rec?.auto).toEqual(['gap']);
    // The last pinned value survives, so un-pinning is lossless.
    expect((rec?.config as { gap: number }).gap).toBe(24);
    expect(JSON.stringify(rec?.config)).not.toContain('Symbol');
  });

  it('pins again when a real value is written to an auto path', () => {
    const { store } = makeWrapper('w1');
    store.getState().updateTrialConfig('w1', 'gap', auto);
    store.getState().updateTrialConfig('w1', 'gap', 30);
    const rec = store.getState().trials[0];
    expect(rec?.auto ?? []).toEqual([]);
    expect((rec?.config as { gap: number }).gap).toBe(30);
  });

  it('does not allocate a new record when the path is already auto', () => {
    const { store } = makeWrapper('w1');
    store.getState().updateTrialConfig('w1', 'gap', auto);
    const first = store.getState().trials[0];
    store.getState().updateTrialConfig('w1', 'gap', auto);
    expect(store.getState().trials[0]).toBe(first);
  });
});
