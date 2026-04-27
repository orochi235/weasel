import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import type { WorkspaceRecord } from '../state/types';
import { DefaultToolbar } from './DefaultToolbar';
import type { WorkspaceToolbarContext } from './slotTypes';
import { WorkspaceChrome } from './WorkspaceChrome';

function makeCtx(overrides: Partial<WorkspaceToolbarContext> = {}): WorkspaceToolbarContext {
  return {
    workspaceId: 'ws-1',
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
    isLastWorkspace: false,
    ...overrides,
  };
}

describe('<DefaultToolbar>', () => {
  it('renders close button', () => {
    render(<DefaultToolbar ctx={makeCtx()} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('disables close when isLastWorkspace is true', () => {
    render(<DefaultToolbar ctx={makeCtx({ isLastWorkspace: true })} />);
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
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('shows load select when snapshots exist', () => {
    const ctx = makeCtx({
      savedSnapshots: [
        {
          id: 's1',
          name: 'First',
          workspaceId: 'ws-1',
          instrumentName: 'Stub',
          config: {},
          state: {},
          savedAt: 1,
        },
      ],
    });
    render(<DefaultToolbar ctx={ctx} />);
    expect(screen.getByRole('combobox', { name: /load snapshot/i })).toBeInTheDocument();
  });
});

const stubInstrument: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

const stubRecord: WorkspaceRecord = {
  id: 'ws-1',
  instrumentName: 'Stub',
  config: {},
  state: {},
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  undoStack: { past: [], future: [] },
};

type ChromeProps = Parameters<typeof WorkspaceChrome>[0];

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
    workspaces: [stubRecord],
    addWorkspace: vi.fn(),
    cloneWorkspace: vi.fn(),
    closeWorkspace: vi.fn(),
    resetWorkspace: vi.fn(),
    savedSnapshots: [],
    saveSnapshot: vi.fn(),
    loadSnapshot: vi.fn(),
    deleteSnapshot: vi.fn(),
    theme: 'auto',
    setTheme: vi.fn(),
    ...labOverrides,
  };
  return (
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={labCtx}>
        <WorkspaceChrome
          workspaceId="ws-1"
          record={stubRecord}
          instrument={stubInstrument}
          isLastWorkspace={false}
          {...props}
        >
          {children ?? <div data-testid="content">content</div>}
        </WorkspaceChrome>
      </LabContext.Provider>
    </LabStoreContext.Provider>
  );
}

describe('<WorkspaceChrome>', () => {
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
    const region = screen.getByRole('region', { name: /workspace/i });
    fireEvent.keyDown(region, { key: 's', metaKey: true });
    expect(saveSnapshot).toHaveBeenCalledWith('ws-1', undefined);
  });
});

describe('<Lab> + WorkspaceChrome integration', () => {
  it('Lab provides context for nested WorkspaceChrome', () => {
    render(<Lab instruments={[stubInstrument]} defaultInstrument="Stub" />);
    // Lab seeds a workspace; no chrome rendered without children — sanity check Lab mounts.
    expect(document.querySelector('.lk-lab')).toBeTruthy();
  });
});
