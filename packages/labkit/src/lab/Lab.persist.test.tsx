import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { createMemoryAdapter, indexedDbAdapter, resetDefaultStorage } from '../state/adapters';
import { labPrefix } from '../state/labRecords';
import type { StorageAdapter } from '../state/types';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

const stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="stub-content">stub</div>,
};

let labRef: LabContextValue | null = null;
function CaptureLab() {
  return (
    <LabContext.Consumer>
      {(value) => {
        labRef = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

/** A memory adapter whose first `list` waits until released. */
function gated() {
  const memory = createMemoryAdapter();
  let release = (): void => {};
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  const storage: StorageAdapter = {
    ...memory,
    list: async (prefix) => {
      await opened;
      return memory.list(prefix);
    },
  };
  return { storage, release };
}

afterEach(() => {
  resetDefaultStorage();
  vi.restoreAllMocks();
});

describe('<Lab> with a storageKey', () => {
  it('renders its fallback until the lab has loaded', async () => {
    const { storage, release } = gated();
    render(
      <Lab
        instruments={[stub]}
        defaultInstrument="Stub"
        storageKey="gate"
        storage={storage}
        fallback={<p>loading</p>}
      />,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-content')).toBeNull();
    await act(async () => release());
    expect(await screen.findByTestId('stub-content')).toBeInTheDocument();
    expect(screen.queryByText('loading')).toBeNull();
  });

  it("falls back to the lab's empty shell by default", () => {
    const { storage } = gated();
    const { container } = render(
      <Lab
        instruments={[stub]}
        defaultInstrument="Stub"
        storageKey="gate"
        storage={storage}
        title="Waiting"
      />,
    );
    expect(container.querySelector('.lk-lab .lk-shell')).not.toBeNull();
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /trial/i })).toBeNull();
  });

  it('opens the lab once under StrictMode', async () => {
    const storage = createMemoryAdapter();
    const list = vi.spyOn(storage, 'list');
    render(
      <StrictMode>
        <Lab instruments={[stub]} defaultInstrument="Stub" storageKey="strict" storage={storage} />
      </StrictMode>,
    );
    await screen.findByTestId('stub-content');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('persists to IndexedDB when given no storage', async () => {
    const view = render(
      <Lab instruments={[stub]} defaultInstrument="Stub" storageKey="idb-lab">
        <CaptureLab />
      </Lab>,
    );
    await screen.findByTestId('stub-content');
    act(() => labRef?.setMode('light'));
    view.unmount();
    await waitFor(async () => {
      const records = new Map(await indexedDbAdapter.list(labPrefix('idb-lab')));
      expect(records.get(`${labPrefix('idb-lab')}meta`)).toMatchObject({ mode: 'light' });
    });
  });

  it('warns when its storageKey changes after mount, and keeps the first', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryAdapter();
    const view = render(
      <Lab instruments={[stub]} defaultInstrument="Stub" storageKey="one" storage={storage} />,
    );
    await screen.findByTestId('stub-content');
    view.rerender(
      <Lab instruments={[stub]} defaultInstrument="Stub" storageKey="two" storage={storage} />,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`storageKey`'));
  });

  it('closes the lab on unmount, sending what was queued', async () => {
    const backing = new Map<string, unknown>();
    const view = render(
      <Lab
        instruments={[stub]}
        defaultInstrument="Stub"
        storageKey="close"
        storage={createMemoryAdapter(backing)}
      >
        <CaptureLab />
      </Lab>,
    );
    await screen.findByTestId('stub-content');
    act(() => labRef?.setMode('dark'));
    view.unmount();
    await waitFor(() =>
      expect(backing.get(`${labPrefix('close')}meta`)).toMatchObject({ mode: 'dark' }),
    );
  });
});
