import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from './adapters';
import { labPrefix } from './labRecords';
import { SingletonExperimentProvider } from './SingletonExperiment';
import { useTrialState } from './useTrialState';

interface Config {
  width: number;
  bg: string;
}
interface State {
  zoom: number;
}

function Provider({
  backing,
  children,
}: {
  backing: Map<string, unknown>;
  children: React.ReactNode;
}) {
  return (
    <SingletonExperimentProvider<State, Config>
      id="test"
      initialConfig={{ width: 100, bg: '#000' }}
      initialState={{ zoom: 1 }}
      storage={createMemoryAdapter(backing)}
      storageKey="test"
      fallback={<p>loading</p>}
    >
      {children}
    </SingletonExperimentProvider>
  );
}

describe('SingletonExperimentProvider', () => {
  it('shows its fallback, then exposes config and state via useTrialState', async () => {
    const backing = new Map<string, unknown>();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider backing={backing}>{children}</Provider>
    );
    const { result } = renderHook(() => useTrialState<State, Config>(), { wrapper });
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(result.current?.config).toEqual({ width: 100, bg: '#000' }));
    expect(result.current.state).toEqual({ zoom: 1 });
  });

  it('persists config changes to storage', async () => {
    const backing = new Map<string, unknown>();
    const Probe = () => {
      const h = useTrialState<State, Config>();
      return (
        <button type="button" onClick={() => h.setConfig('width', 200)}>
          go
        </button>
      );
    };
    render(
      <Provider backing={backing}>
        <Probe />
      </Provider>,
    );
    const go = await screen.findByText('go');
    act(() => go.click());
    await waitFor(() =>
      expect(backing.get(`${labPrefix('test')}trial:test`)).toMatchObject({
        config: { width: 200 },
      }),
    );
  });

  it('rehydrates from storage on mount', async () => {
    const backing = new Map<string, unknown>();
    // A pre-document lab, which opening folds forward.
    backing.set(
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
      <Provider backing={backing}>{children}</Provider>
    );
    const { result } = renderHook(() => useTrialState<State, Config>(), { wrapper });
    await waitFor(() => expect(result.current?.config).toEqual({ width: 999, bg: '#fff' }));
    expect(result.current.state).toEqual({ zoom: 2 });
  });
});
