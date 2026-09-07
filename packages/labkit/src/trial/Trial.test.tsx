import { fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useStore } from 'zustand/react';
import { f } from '../config/builder';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import type { SavedSnapshot, TrialRecord } from '../state/types';
import { TrialChrome } from './TrialChrome';

const Glyph = () => <svg />;

const stubInstrument: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

const stubRecord: TrialRecord = {
  id: 'ws-1',
  instrumentName: 'Stub',
  config: {},
  state: {},
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  undoStack: { past: [], future: [] },
};

type ChromeProps = Parameters<typeof TrialChrome>[0];

/** A store holding the stub trial, as `Trial` would have put it there. Title
 *  and section folds live on the record, so a test that outlives one mount
 *  keeps its own store and hands it to both. */
function makeChromeStore() {
  const store = createLabStore({
    storageKey: 'test',
    storage: { read: () => null, write: () => {} },
  });
  const { undoStack: _undo, ...seed } = stubRecord;
  store.getState().addTrial(seed);
  return store;
}

function ChromeHarness({
  children,
  labOverrides,
  instrument = stubInstrument,
  store: storeProp,
  ...props
}: {
  children?: ReactNode;
  labOverrides?: Partial<LabContextValue>;
  store?: ReturnType<typeof createLabStore>;
} & Partial<ChromeProps>) {
  const [ownStore] = useState(makeChromeStore);
  const store = storeProp ?? ownStore;
  const labCtx: LabContextValue = {
    instruments: [instrument],
    trials: [stubRecord],
    addTrial: vi.fn(),
    cloneTrial: vi.fn(),
    closeTrial: vi.fn(),
    resetTrial: vi.fn(),
    reorderTrials: vi.fn(),
    savedSnapshots: [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
    deleteSnapshot: vi.fn(),
    mode: 'auto',
    setMode: vi.fn(),
    ...labOverrides,
  };
  return (
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={labCtx}>
        <ChromeFromStore store={store} instrument={instrument} {...props}>
          {children ?? <div data-testid="content">content</div>}
        </ChromeFromStore>
      </LabContext.Provider>
    </LabStoreContext.Provider>
  );
}

/** Reads the record out of the store the way `Trial` does, so a mutation the
 *  chrome writes comes back to it. */
function ChromeFromStore({
  store,
  children,
  ...props
}: { store: ReturnType<typeof createLabStore>; children: ReactNode } & Partial<ChromeProps> &
  Pick<ChromeProps, 'instrument'>) {
  const record = useStore(store, (s) => s.trials.find((t) => t.id === 'ws-1'));
  if (!record) throw new Error('no stub trial in the store');
  return (
    <TrialChrome trialId="ws-1" record={record} isLastTrial={false} {...props}>
      {children}
    </TrialChrome>
  );
}

describe('<TrialChrome>', () => {
  it('renders children in the content area', () => {
    render(<ChromeHarness />);
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders the built-in trial actions', () => {
    render(<ChromeHarness />);
    expect(screen.getByRole('button', { name: 'Close trial' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clone trial' })).toBeInTheDocument();
  });

  it('puts clone, reset and snapshot at the end of the title bar, beside close', () => {
    const { container } = render(<ChromeHarness />);
    const titlebar = container.querySelector('.lk-trial__titlebar');
    if (!titlebar) throw new Error('no title bar');
    expect(titlebar).toContainElement(screen.getByRole('button', { name: 'Clone trial' }));
    expect(titlebar).toContainElement(screen.getByRole('button', { name: 'Reset trial' }));
    const labels = [...titlebar.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Clone trial', 'Reset trial', 'Save snapshot', 'Close trial']);
  });

  it('disables close on the last trial', () => {
    render(<ChromeHarness isLastTrial />);
    expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
  });

  it('omits undo and redo unless the instrument declares undo', () => {
    render(<ChromeHarness />);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    render(
      <ChromeHarness
        instrument={{ ...stubInstrument, undo: {} }}
        undoBindings={{ canUndo: true, canRedo: false, undo: vi.fn(), redo: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('offers the snapshot loader once a snapshot exists', () => {
    const snapshot: SavedSnapshot = {
      id: 's1',
      name: 'First',
      trialId: 'ws-1',
      instrumentName: 'Stub',
      config: {},
      state: {},
      savedAt: 1,
    };
    render(<ChromeHarness labOverrides={{ savedSnapshots: [snapshot] }} />);
    expect(screen.getByRole('button', { name: /load snapshot/i })).toBeInTheDocument();
  });

  it('renders a consumer contribution alongside the built-ins', () => {
    render(<ChromeHarness chrome={[{ id: 'mine', region: 'status', item: { text: 'ready' } }]} />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('leads the title bar with a contribution that does not set `end`', () => {
    const { container } = render(
      <ChromeHarness
        chrome={[
          {
            id: 'subject',
            region: 'titlebar',
            item: { icon: Glyph, label: 'Pick subject', onActivate: () => {} },
          },
        ]}
      />,
    );
    const titlebar = container.querySelector('.lk-trial__titlebar');
    if (!titlebar) throw new Error('no title bar');
    const lead = screen.getByRole('button', { name: 'Pick subject' });
    const heading = titlebar.querySelector('.lk-trial__title');
    if (!heading) throw new Error('no title');
    expect(titlebar.querySelector('.lk-trial__titlebar-lead')).toContainElement(lead);
    expect(lead.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads the instrument name until a contribution calls setTitle', () => {
    render(
      <ChromeHarness
        chrome={[
          {
            id: 'rename',
            region: 'titlebar',
            item: {
              icon: Glyph,
              label: 'Rename',
              onActivate: (ctx) => ctx.setTitle('Sprocket 7'),
            },
          },
        ]}
      />,
    );
    expect(screen.getByRole('region', { name: 'Trial Stub' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByText('Sprocket 7')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Trial Sprocket 7' })).toBeInTheDocument();
  });

  it('Cmd+S triggers saveSnapshot', () => {
    const saveSnapshot = vi.fn();
    render(<ChromeHarness labOverrides={{ saveSnapshot }} />);
    const region = screen.getByRole('region', { name: /trial/i });
    fireEvent.keyDown(region, { key: 's', metaKey: true });
    expect(saveSnapshot).toHaveBeenCalledWith('ws-1', undefined);
  });
});

describe('chrome regions in a mounted lab', () => {
  function renderLabWith(instrument: Instrument) {
    return render(<Lab title="T" instruments={[instrument]} defaultInstrument={instrument.name} />);
  }

  it('puts zoom in the viewport region and not in the toolbar', () => {
    renderLabWith({ ...stubInstrument, canvas: { layers: [] }, undo: {} });
    const toolbar = document.querySelector('.lk-trial__toolbar') as HTMLElement;
    const viewport = document.querySelector('.lk-viewport-controls') as HTMLElement;
    expect(within(viewport).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Zoom in' })).toBeNull();
  });

  it('renders no undo group for an instrument that does not declare undo', () => {
    renderLabWith({ ...stubInstrument, canvas: { layers: [] } });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('renders no viewport region for an instrument with no canvas', () => {
    renderLabWith(stubInstrument);
    expect(document.querySelector('.lk-viewport-controls')).toBeNull();
  });

  it('Lab provides context for nested TrialChrome', () => {
    renderLabWith(stubInstrument);
    expect(document.querySelector('.lk-lab')).toBeTruthy();
  });
});

describe('<TrialChrome> — state that outlives a mount', () => {
  const renameChrome: ChromeProps['chrome'] = [
    {
      id: 'rename',
      region: 'titlebar',
      item: {
        icon: Glyph,
        label: 'Rename',
        onActivate: (ctx) => ctx.setTitle('Sprocket 7'),
      },
    },
  ];

  const sectionChrome: ChromeProps['chrome'] = [
    {
      id: 'notes',
      region: 'sidebar',
      item: { title: 'Notes', body: <p data-testid="notes-body">notes</p> },
    },
  ];

  it('keeps a title across a remount', () => {
    const store = makeChromeStore();
    const first = render(<ChromeHarness store={store} chrome={renameChrome} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    first.unmount();

    render(<ChromeHarness store={store} chrome={renameChrome} />);
    expect(screen.getByRole('region', { name: 'Trial Sprocket 7' })).toBeInTheDocument();
  });

  it('keeps a folded sidebar section across a remount', () => {
    const store = makeChromeStore();
    const first = render(<ChromeHarness store={store} chrome={sectionChrome} />);
    expect(screen.getByTestId('notes-body')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.queryByTestId('notes-body')).toBeNull();
    first.unmount();

    render(<ChromeHarness store={store} chrome={sectionChrome} />);
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('notes-body')).toBeNull();
  });

  it('keeps a folded settings group across a remount', () => {
    const sectioned: Instrument = {
      ...stubInstrument,
      config: f.schema({ size: f.number(1).section('Shape') }),
    };
    const store = makeChromeStore();
    const first = render(<ChromeHarness store={store} instrument={sectioned} />);
    const twisty = screen.getByRole('button', { name: 'Shape' });
    expect(twisty).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(twisty);
    first.unmount();

    render(<ChromeHarness store={store} instrument={sectioned} />);
    expect(screen.getByRole('button', { name: 'Shape' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('reopens a section that starts collapsed, and keeps it open across a remount', () => {
    const collapsedChrome: ChromeProps['chrome'] = [
      {
        id: 'notes',
        region: 'sidebar',
        item: {
          title: 'Notes',
          defaultCollapsed: true,
          body: <p data-testid="notes-body">notes</p>,
        },
      },
    ];
    const store = makeChromeStore();
    const first = render(<ChromeHarness store={store} chrome={collapsedChrome} />);
    expect(screen.queryByTestId('notes-body')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    first.unmount();

    render(<ChromeHarness store={store} chrome={collapsedChrome} />);
    expect(screen.getByTestId('notes-body')).toBeInTheDocument();
  });
});
