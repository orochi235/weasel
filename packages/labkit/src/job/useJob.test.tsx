import { act, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { JobCapability, JobEvent, JobHandle } from './types';
import { useJob } from './useJob';

interface State {
  items: number[];
}
interface Config {
  n: number;
}

/** Yields 0..n-1, pausing between each so a test can cancel mid-run. */
async function* counter(
  n: number,
  signal: AbortSignal,
  failAt?: number,
): AsyncGenerator<JobEvent<number>> {
  yield { kind: 'total', total: n };
  for (let i = 0; i < n; i++) {
    await new Promise((r) => setTimeout(r, 2));
    if (signal.aborted) return;
    if (i === failAt) {
      yield { kind: 'failed', index: i, error: 'frame died' };
      continue;
    }
    yield { kind: 'item', item: i };
  }
}

const capability = (failAt?: number): JobCapability<State, Config, number> => ({
  run: ({ config, signal }) => counter(config.n, signal, failAt),
  onItem: (item, state) => ({ items: [...state.items, item] }),
});

interface HarnessProps {
  capability: JobCapability<State, Config, number>;
  config: Config;
  onHandle: (h: JobHandle, s: State) => void;
}

function Harness({ capability: cap, config, onHandle }: HarnessProps) {
  const [state, setState] = useState<State>({ items: [] });
  const job = useJob({ capability: cap, config, state, setState });
  onHandle(job, state);
  return null;
}

describe('useJob', () => {
  it('folds each item into state and counts progress', async () => {
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={capability()}
        config={{ n: 3 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('done'));
    expect(state.items).toEqual([0, 1, 2]);
    expect(handle?.done).toBe(3);
    expect(handle?.total).toBe(3);
  });

  it('counts a failed item without ending the run', async () => {
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={capability(1)}
        config={{ n: 3 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('done'));
    expect(state.items).toEqual([0, 2]);
    expect(handle?.failures).toEqual([{ index: 1, error: 'frame died' }]);
    expect(handle?.done).toBe(2);
  });

  it('stops folding results once cancelled', async () => {
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={capability()}
        config={{ n: 50 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('running'));
    act(() => handle?.cancel());
    const atCancel = state.items.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(state.items.length).toBe(atCancel);
    expect(handle?.status).toBe('idle');
  });

  it('discards results from a run its key superseded', async () => {
    const withKey: JobCapability<State, Config, number> = {
      ...capability(),
      key: (config) => [config.n],
      auto: true,
    };
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    const { rerender } = render(
      <Harness
        capability={withKey}
        config={{ n: 40 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    await waitFor(() => expect(handle?.status).toBe('running'));

    rerender(
      <Harness
        capability={withKey}
        config={{ n: 2 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    await waitFor(() => expect(handle?.status).toBe('done'));

    // The superseded 40-item run cannot have contributed: the winner yields two.
    expect(state.items).toEqual([0, 1]);
  });

  it('aborts on unmount', async () => {
    const aborted = vi.fn();
    const watching: JobCapability<State, Config, number> = {
      run: ({ signal }) => {
        signal.addEventListener('abort', aborted);
        return counter(50, signal);
      },
      onItem: (item, state) => ({ items: [...state.items, item] }),
    };
    let handle: JobHandle | null = null;
    const { unmount } = render(
      <Harness
        capability={watching}
        config={{ n: 50 }}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('running'));
    unmount();
    expect(aborted).toHaveBeenCalled();
  });

  it('reports a thrown error without losing the items already folded', async () => {
    const throwing: JobCapability<State, Config, number> = {
      run: async function* () {
        yield { kind: 'item', item: 7 };
        await new Promise((r) => setTimeout(r, 1));
        throw new Error('the baker died');
      },
      onItem: (item, state) => ({ items: [...state.items, item] }),
    };
    let handle: JobHandle | null = null;
    let state: State = { items: [] };
    render(
      <Harness
        capability={throwing}
        config={{ n: 1 }}
        onHandle={(h, s) => {
          handle = h;
          state = s;
        }}
      />,
    );
    act(() => handle?.start());
    await waitFor(() => expect(handle?.status).toBe('error'));
    expect(handle?.error).toMatch(/the baker died/);
    expect(state.items).toEqual([7]);
  });

  it('does not start on its own without auto', async () => {
    let handle: JobHandle | null = null;
    render(
      <Harness
        capability={{ ...capability(), key: (c) => [c.n] }}
        config={{ n: 3 }}
        onHandle={(h) => {
          handle = h;
        }}
      />,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(handle?.status).toBe('idle');
  });
});
