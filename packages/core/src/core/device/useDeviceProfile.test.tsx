import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useDeviceProfile, DeviceProfileProvider } from './useDeviceProfile';
import { COARSE_TARGET_SCALE } from './profile';

/** Minimal MediaQueryList double with a manual `fire()`. */
function makeMatchMedia(matches: Record<string, boolean>) {
  const listeners = new Map<string, Set<(e: { matches: boolean }) => void>>();
  const state = { ...matches };
  const mm = (query: string) => ({
    matches: state[query] ?? false,
    media: query,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(cb);
    },
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.get(query)?.delete(cb);
    },
  });
  return {
    mm,
    fire(query: string, matches: boolean) {
      state[query] = matches;
      for (const cb of listeners.get(query) ?? []) cb({ matches });
    },
    listenerCount: (query: string) => listeners.get(query)?.size ?? 0,
  };
}

function Probe() {
  const d = useDeviceProfile();
  return (
    <div data-testid="out">
      {`${d.coarsePointer}|${d.canHover}|${d.dpr}|${d.targetScale}`}
    </div>
  );
}

const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
});

describe('useDeviceProfile', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1, configurable: true, writable: true,
    });
  });

  it('falls back to the default profile when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Probe />);
    expect(screen.getByTestId('out').textContent).toBe('false|true|1|1');
  });

  it('reads pointer coarseness and hover capability from matchMedia', () => {
    const { mm } = makeMatchMedia({
      '(pointer: coarse)': true,
      '(hover: hover)': false,
    });
    vi.stubGlobal('matchMedia', mm);
    render(<Probe />);
    expect(screen.getByTestId('out').textContent).toBe(
      `true|false|1|${COARSE_TARGET_SCALE}`,
    );
  });

  it('updates when the pointer-coarseness query changes', () => {
    const h = makeMatchMedia({ '(pointer: coarse)': false, '(hover: hover)': true });
    vi.stubGlobal('matchMedia', h.mm);
    render(<Probe />);
    expect(screen.getByTestId('out').textContent).toBe('false|true|1|1');

    act(() => { h.fire('(pointer: coarse)', true); });
    expect(screen.getByTestId('out').textContent).toBe(
      `true|true|1|${COARSE_TARGET_SCALE}`,
    );
  });

  it('re-arms the resolution query so a second DPR change is still observed', () => {
    const h = makeMatchMedia({
      '(pointer: coarse)': false,
      '(hover: hover)': true,
      '(resolution: 1dppx)': true,
    });
    vi.stubGlobal('matchMedia', h.mm);
    render(<Probe />);

    // First change: DPR moves to 2. The 1dppx query stops matching.
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2, configurable: true, writable: true,
    });
    act(() => { h.fire('(resolution: 1dppx)', false); });
    expect(screen.getByTestId('out').textContent).toBe('false|true|2|1');

    // Second change: a listener must now exist on the RE-ARMED 2dppx query.
    expect(h.listenerCount('(resolution: 2dppx)')).toBe(1);
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 3, configurable: true, writable: true,
    });
    act(() => { h.fire('(resolution: 2dppx)', false); });
    expect(screen.getByTestId('out').textContent).toBe('false|true|3|1');
  });

  it('DeviceProfileProvider overrides detected facts', () => {
    const { mm } = makeMatchMedia({ '(pointer: coarse)': false, '(hover: hover)': true });
    vi.stubGlobal('matchMedia', mm);
    render(
      <DeviceProfileProvider value={{ coarsePointer: true }}>
        <Probe />
      </DeviceProfileProvider>,
    );
    expect(screen.getByTestId('out').textContent).toBe(
      `true|true|1|${COARSE_TARGET_SCALE}`,
    );
  });
});
