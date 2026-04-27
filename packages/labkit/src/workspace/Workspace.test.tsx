import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DefaultToolbar } from './DefaultToolbar';
import type { WorkspaceToolbarContext } from './slotTypes';

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
