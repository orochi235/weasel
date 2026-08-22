import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { LabStoreProvider, TrialIdProvider } from './context';
import { createLabStore } from './store';
import { useTrialState } from './useTrialState';

type TestState = { count: number };
type TestConfig = { step: number };

function makeWrapper(trialId: string) {
  const store = createLabStore({ storageKey: 'test', storage: createMemoryAdapter() });
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
    const store = createLabStore({ storageKey: 'test', storage: createMemoryAdapter() });
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
