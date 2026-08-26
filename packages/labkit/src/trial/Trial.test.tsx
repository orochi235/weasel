import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import type { SavedSnapshot, TrialRecord } from '../state/types';
import { TrialChrome } from './TrialChrome';

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

function ChromeHarness({
  children,
  labOverrides,
  instrument = stubInstrument,
  ...props
}: { children?: ReactNode; labOverrides?: Partial<LabContextValue> } & Partial<ChromeProps>) {
  const store = createLabStore({
    storageKey: 'test',
    storage: { read: () => null, write: () => {} },
  });
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
        <TrialChrome
          trialId="ws-1"
          record={stubRecord}
          instrument={instrument}
          isLastTrial={false}
          {...props}
        >
          {children ?? <div data-testid="content">content</div>}
        </TrialChrome>
      </LabContext.Provider>
    </LabStoreContext.Provider>
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
