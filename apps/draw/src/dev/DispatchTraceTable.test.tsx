import { fireEvent, render, screen } from '@testing-library/react';
import { DispatchTraceTable } from './DispatchTraceTable';
import type { DispatchRecord, TraceLogEntry } from './dispatchTraceLog';
import { recordOf } from './dispatchTraceFixtures';

const ENTRIES: TraceLogEntry[] = [
  recordOf({ ts: 1000, eventKind: 'drag', ranked: ['move', 'viewport.dragPan'] }),
  recordOf({ ts: 1100, eventKind: 'hover', ranked: [] }),
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

  it('opens a dispatch row to its fallthrough diagram on click, and closes it again', () => {
    render(<DispatchTraceTable entries={ENTRIES} now={2000} />);
    const row = screen.getByRole('row', { name: /drag/ });
    expect(screen.queryByText('viewport.dragPan')).toBeNull();
    fireEvent.click(row);
    expect(screen.getAllByText('viewport.dragPan').length).toBeGreaterThan(0);
    expect(screen.getByText('Ranked')).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText('viewport.dragPan')).toBeNull();
  });

  it('pins a live prediction above the log', () => {
    const live: DispatchRecord = { ...recordOf({ ts: 3000, eventKind: 'pointerdown', ranked: ['move'] }), predicted: true };
    render(<DispatchTraceTable entries={ENTRIES} live={live} now={2000} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]!.textContent).toContain('live');
    expect(rows[0]!.textContent).toContain('pointerdown');
  });

  it('offers no disclosure on a mode-switch row', () => {
    render(<DispatchTraceTable entries={ENTRIES} now={2000} />);
    expect(screen.getAllByRole('button', { name: 'Show details' })).toHaveLength(1);
    expect(screen.getByRole('row', { name: /text/ }).querySelector('button')).toBeNull();
  });
});
