import { act, fireEvent, render, screen } from '@testing-library/react';
import { DispatchTracePanel } from './DispatchTracePanel';
import type { TraceLogEntry } from './dispatchTraceLog';

const LOG: TraceLogEntry[] = [
  { kind: 'dispatch', ts: 1000, eventKind: 'drag', outcome: 'handled', fired: 'move', candidates: [] },
  { kind: 'dispatch', ts: 1100, eventKind: 'hover', outcome: 'unhandled', fired: null, candidates: [] },
];

beforeEach(() => {
  (window as { __weaselDispatchLog__?: TraceLogEntry[] }).__weaselDispatchLog__ = LOG.slice();
  const host = document.createElement('div');
  host.className = 'wd-canvas-host';
  document.body.appendChild(host);
});

afterEach(() => {
  delete (window as { __weaselDispatchLog__?: TraceLogEntry[] }).__weaselDispatchLog__;
  document.querySelector('.wd-canvas-host')?.remove();
});

describe('DispatchTracePanel', () => {
  it('filters rows by outcome with the two toggles', () => {
    render(<DispatchTracePanel />);
    expect(screen.getByText('drag')).toBeTruthy();
    expect(screen.queryByText('hover')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Unhandled events' }));
    expect(screen.getByText('hover')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Handled events' }));
    expect(screen.queryByText('drag')).toBeNull();
    expect(screen.getByRole('button', { name: 'Handled events' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('collapses to its bar', () => {
    render(<DispatchTracePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Dispatch trace', expanded: true }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dispatch trace' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('clears the log', () => {
    render(<DispatchTracePanel />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Clear log' })); });
    expect(screen.getByText('0 entries')).toBeTruthy();
  });
});
