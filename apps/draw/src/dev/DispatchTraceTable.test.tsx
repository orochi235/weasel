import { fireEvent, render, screen } from '@testing-library/react';
import { DispatchTraceTable } from './DispatchTraceTable';
import type { TraceLogEntry } from './dispatchTraceLog';

const ENTRIES: TraceLogEntry[] = [
  {
    kind: 'dispatch', ts: 1000, eventKind: 'drag', outcome: 'handled', fired: 'move',
    candidates: [
      { actionId: 'move', scope: 'active', enabledResult: true },
      { actionId: 'viewport.dragPan', scope: 'ambient', enabledResult: 'shadowed' },
    ],
  },
  { kind: 'dispatch', ts: 1100, eventKind: 'hover', outcome: 'unhandled', fired: null, candidates: [] },
  { kind: 'mode', ts: 1200, mode: 'text', from: null, to: 'editing' },
];

describe('DispatchTraceTable', () => {
  it('lists newest first and hides unhandled dispatches by default', () => {
    render(<DispatchTraceTable entries={ENTRIES} now={2000} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('text');
    expect(rows[1]!.textContent).toContain('drag');
    expect(screen.queryByText('hover')).toBeNull();
  });

  it('shows unhandled dispatches when asked', () => {
    render(<DispatchTraceTable entries={ENTRIES} now={2000} showUnhandled />);
    expect(screen.getByText('hover')).toBeTruthy();
  });

  it('opens a dispatch row to its candidates on click, and closes it again', () => {
    render(<DispatchTraceTable entries={ENTRIES} now={2000} />);
    const row = screen.getByRole('row', { name: /drag/ });
    expect(screen.queryByText('viewport.dragPan')).toBeNull();
    fireEvent.click(row);
    expect(screen.getByText('viewport.dragPan')).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText('viewport.dragPan')).toBeNull();
  });

  it('offers no disclosure on a mode-switch row', () => {
    render(<DispatchTraceTable entries={ENTRIES} now={2000} />);
    expect(screen.getAllByRole('button', { name: 'Show details' })).toHaveLength(1);
  });
});
