import { act, fireEvent, screen } from '@testing-library/react';
import { createDispatchTrace, createTraceRing } from '@weasel-js/core/routing';
import { createDevtoolsRoot, installDevtoolsHook, type DevtoolsRootSource } from '@weasel-js/core/devtools';
import { DispatchTracePanel } from './DispatchTracePanel';
import type { TraceLogEntry } from './dispatchTraceLog';
import { recordOf } from './dispatchTraceFixtures';
import { renderWithIcons } from '../testIcons';

const LOG: TraceLogEntry[] = [
  recordOf({ ts: 1000, eventKind: 'drag', ranked: ['move'] }),
  recordOf({ ts: 1100, eventKind: 'hover', ranked: [] }),
];

let unregister: () => void = () => {};

/** A canvas root whose trace already holds `LOG`, as the panel's hook sees it. */
function registerTrace(): void {
  const trace = createDispatchTrace(200, true);
  for (const entry of LOG) trace.push(entry);
  const source: DevtoolsRootSource = {
    label: () => 'canvas', dimension: '2d', scene: () => null, selection: () => [], select: () => {},
    view: () => null, activeTool: () => null, tools: () => [], setTool: () => {},
    trace, coords: createTraceRing(), frame: () => null, overlays: () => null, setOverride: () => {},
  };
  unregister = installDevtoolsHook()!.register(createDevtoolsRoot(source));
}

beforeEach(() => {
  vi.useFakeTimers();
  registerTrace();
  const host = document.createElement('div');
  host.className = 'wd-canvas-host';
  document.body.appendChild(host);
});

afterEach(() => {
  unregister();
  vi.useRealTimers();
  document.querySelector('.wd-canvas-host')?.remove();
});

describe('DispatchTracePanel', () => {
  const mount = () => {
    renderWithIcons(<DispatchTracePanel />);
    act(() => { vi.advanceTimersByTime(250); });
  };

  it('filters rows by outcome with the two toggles', () => {
    mount();
    expect(screen.getByText('drag')).toBeTruthy();
    expect(screen.queryByText('hover')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Unhandled events' }));
    expect(screen.getByText('hover')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Handled events' }));
    expect(screen.queryByText('drag')).toBeNull();
    expect(screen.getByRole('button', { name: 'Handled events' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('collapses to its bar', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Dispatch trace', expanded: true }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dispatch trace' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('clears the log', () => {
    mount();
    expect(screen.getByText('drag')).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Clear log' })); });
    expect(screen.getByText('0 entries')).toBeTruthy();
  });
});
