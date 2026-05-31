import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { SingletonExperimentProvider } from './SingletonExperiment';
import { useExperimentState } from './useExperimentState';

interface Config {
  width: number;
  bg: string;
}
interface State {
  zoom: number;
}

describe('SingletonExperimentProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes config and state via useExperimentState', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SingletonExperimentProvider<State, Config>
        id="test"
        initialConfig={{ width: 100, bg: '#000' }}
        initialState={{ zoom: 1 }}
        storage={createMemoryAdapter()}
        storageKey="test"
      >
        {children}
      </SingletonExperimentProvider>
    );
    const { result } = renderHook(() => useExperimentState<State, Config>(), { wrapper });
    expect(result.current.config).toEqual({ width: 100, bg: '#000' });
    expect(result.current.state).toEqual({ zoom: 1 });
  });

  it('persists config changes to storage', () => {
    vi.useFakeTimers();
    const storage = createMemoryAdapter();
    const Probe = () => {
      const h = useExperimentState<State, Config>();
      return (
        <button type="button" onClick={() => h.setConfig('width', 200)}>
          go
        </button>
      );
    };
    const { getByText } = render(
      <SingletonExperimentProvider<State, Config>
        id="test"
        initialConfig={{ width: 100, bg: '#000' }}
        initialState={{ zoom: 1 }}
        storage={storage}
        storageKey="test"
      >
        <Probe />
      </SingletonExperimentProvider>,
    );
    act(() => {
      getByText('go').click();
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    // createLabStore uses labStorageKey which prefixes with "lk:"
    const raw = storage.read('lk:test:workspaces');
    expect(raw).toBeTruthy();
    expect(raw).toContain('"width":200');
  });

  it('rehydrates from storage on mount', () => {
    const storage = createMemoryAdapter();
    // createLabStore uses labStorageKey which prefixes with "lk:"
    storage.write(
      'lk:test:workspaces',
      JSON.stringify([
        {
          id: 'test',
          instrumentName: '__singleton__',
          config: { width: 999, bg: '#fff' },
          state: { zoom: 2 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
        },
      ]),
    );
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SingletonExperimentProvider<State, Config>
        id="test"
        initialConfig={{ width: 100, bg: '#000' }}
        initialState={{ zoom: 1 }}
        storage={storage}
        storageKey="test"
      >
        {children}
      </SingletonExperimentProvider>
    );
    const { result } = renderHook(() => useExperimentState<State, Config>(), { wrapper });
    expect(result.current.config).toEqual({ width: 999, bg: '#fff' });
    expect(result.current.state).toEqual({ zoom: 2 });
  });
});
