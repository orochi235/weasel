import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { DefaultToolbar } from './DefaultToolbar';
import type { TrialToolbarContext } from './slotTypes';
import { TrialChrome } from './TrialChrome';

function makeCtx(overrides: Partial<TrialToolbarContext> = {}): TrialToolbarContext {
  return {
    trialId: 'ws-1',
    instrumentName: 'Stub',
    hasUndo: false,
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    zoom: 1,
    setZoom: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: vi.fn(),
    hasCanvas: false,
    savedSnapshots: [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
    clone: vi.fn(),
    reset: vi.fn(),
    close: vi.fn(),
    isLastTrial: false,
    ...overrides,
  };
}

describe('<DefaultToolbar>', () => {
  it('renders close button', () => {
    render(<DefaultToolbar ctx={makeCtx()} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('disables close when isLastTrial is true', () => {
    render(<DefaultToolbar ctx={makeCtx({ isLastTrial: true })} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
  });

  it('omits undo/redo buttons when hasUndo is false', () => {
    render(<DefaultToolbar ctx={makeCtx({ hasUndo: false })} />);
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /redo/i })).toBeNull();
  });

  it('shows undo/redo buttons when hasUndo is true', () => {
    render(<DefaultToolbar ctx={makeCtx({ hasUndo: true, canUndo: true, canRedo: false })} />);
    expect(screen.getByRole('button', { name: /undo/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });

  it('omits zoom buttons when hasCanvas is false', () => {
    render(<DefaultToolbar ctx={makeCtx({ hasCanvas: false })} />);
    expect(screen.queryByTitle('Zoom in')).toBeNull();
    expect(screen.queryByTitle('Zoom out')).toBeNull();
  });

  it('shows zoom controls when hasCanvas is true', () => {
    render(<DefaultToolbar ctx={makeCtx({ hasCanvas: true, zoom: 1.5 })} />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    // Zoom is an editable field now, not a readout.
    expect(screen.getByRole('textbox', { name: /zoom/i })).toHaveValue('150%');
    expect(screen.getByRole('slider', { name: /zoom/i })).toBeInTheDocument();
  });

  it('shows load select when snapshots exist', () => {
    const ctx = makeCtx({
      savedSnapshots: [
        {
          id: 's1',
          name: 'First',
          trialId: 'ws-1',
          instrumentName: 'Stub',
          config: {},
          state: {},
          savedAt: 1,
        },
      ],
    });
    render(<DefaultToolbar ctx={ctx} />);
    expect(screen.getByRole('button', { name: /load snapshot/i })).toBeInTheDocument();
  });
});

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
  ...props
}: { children?: ReactNode; labOverrides?: Partial<LabContextValue> } & Partial<ChromeProps>) {
  const store = createLabStore({
    storageKey: 'test',
    storage: { read: () => null, write: () => {} },
  });
  const labCtx: LabContextValue = {
    instruments: [stubInstrument],
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
          instrument={stubInstrument}
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

  it('renders default toolbar when no toolbar prop is given', () => {
    render(<ChromeHarness />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('renders custom toolbar when toolbar prop is provided', () => {
    render(<ChromeHarness toolbar={() => <div data-testid="custom-toolbar">custom</div>} />);
    expect(screen.getByTestId('custom-toolbar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });

  it('Cmd+S triggers saveSnapshot', () => {
    const saveSnapshot = vi.fn();
    render(<ChromeHarness labOverrides={{ saveSnapshot }} />);
    const region = screen.getByRole('region', { name: /trial/i });
    fireEvent.keyDown(region, { key: 's', metaKey: true });
    expect(saveSnapshot).toHaveBeenCalledWith('ws-1', undefined);
  });
});

describe('<Lab> + TrialChrome integration', () => {
  it('Lab provides context for nested TrialChrome', () => {
    render(<Lab instruments={[stubInstrument]} defaultInstrument="Stub" />);
    // Lab seeds a trial; no chrome rendered without children — sanity check Lab mounts.
    expect(document.querySelector('.lk-lab')).toBeTruthy();
  });
});
