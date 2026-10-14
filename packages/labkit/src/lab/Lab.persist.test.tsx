import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryAdapter, type StorageAdapter } from '@weasel-js/storage';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { CURRENT_DOCUMENT_VERSION } from '../state/document';
import { labPrefix } from '../state/labRecords';
import { indexedDbAdapter, resetDefaultStorage } from '../state/labStorage';
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
    const backing = new Map<string, unknown>();
    const storage = createMemoryAdapter(backing);
    const view = render(
      <Lab instruments={[stub]} defaultInstrument="Stub" storageKey="one" storage={storage}>
        <CaptureLab />
      </Lab>,
    );
    await screen.findByTestId('stub-content');
    view.rerender(
      <Lab instruments={[stub]} defaultInstrument="Stub" storageKey="two" storage={storage}>
        <CaptureLab />
      </Lab>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`storageKey`'));
    await screen.findByTestId('stub-content');
    act(() => labRef?.setMode('light'));
    view.unmount();
    await waitFor(() =>
      expect(backing.get(`${labPrefix('one')}meta`)).toMatchObject({ mode: 'light' }),
    );
    expect([...backing.keys()].filter((key) => key.startsWith(labPrefix('two')))).toEqual([]);
  });

  it('lists a stored trial that fails to load, and deletes its record when it is discarded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const P = labPrefix('bad');
    const stored = { instrumentName: 'Stub', config: {}, view: null };
    const backing = new Map<string, unknown>([
      [`${P}meta`, { version: CURRENT_DOCUMENT_VERSION, mode: 'auto' }],
      [`${P}trial:ok`, { ...stored, id: 'ok', state: {}, order: 0 }],
      [
        `${P}trial:broken`,
        { ...stored, id: 'broken', state: { bad: true }, title: 'Mine', order: 1 },
      ],
    ]);
    const picky: Instrument = {
      ...stub,
      deserialize: (data) => {
        if ((data as { bad?: boolean }).bad) throw new Error('unreadable state');
        return data as object;
      },
    };
    render(
      <Lab
        instruments={[picky]}
        defaultInstrument="Stub"
        storageKey="bad"
        storage={createMemoryAdapter(backing)}
      />,
    );
    await screen.findByTestId('stub-content');
    const list = screen.getByRole('list', { name: 'Stored records that failed to load' });
    expect(list).toHaveTextContent(
      'Trial "Mine" (Stub) failed to load and is left out: unreadable state',
    );
    expect(backing.has(`${P}trial:broken`)).toBe(true);

    await act(async () =>
      screen.getByRole('button', { name: 'Discard Trial "Mine" (Stub)' }).click(),
    );
    expect(screen.queryByRole('list', { name: 'Stored records that failed to load' })).toBeNull();
    await waitFor(() => expect(backing.has(`${P}trial:broken`)).toBe(false));
    expect(backing.has(`${P}trial:ok`)).toBe(true);
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
