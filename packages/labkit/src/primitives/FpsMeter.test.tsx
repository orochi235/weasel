import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FpsMeter } from './FpsMeter';

describe('FpsMeter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders an FPS label', () => {
    render(<FpsMeter />);
    expect(screen.getByText(/fps/i)).toBeInTheDocument();
  });

  test('uses lk-fps-meter class', () => {
    const { container } = render(<FpsMeter />);
    expect((container.firstChild as HTMLElement).className).toBe('lk-fps-meter');
  });

  test('updates after a tick', () => {
    let raf: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      raf = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    render(<FpsMeter />);
    act(() => {
      raf?.(0);
      raf?.(16.67);
      raf?.(33.34);
    });
    expect(screen.getByText(/FPS\s+\d+/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  test('does not report a fabricated rate after a spell in a background tab', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const setHidden = (next: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => next });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    const run = (t: number) => {
      const due = frames.splice(0, frames.length);
      for (const cb of due) cb(t);
    };

    render(<FpsMeter />);
    act(() => {
      run(0);
      run(16.67);
      run(33.34);
    });
    const before = screen.getByText(/FPS\s+\d+/).textContent;

    // An hour hidden. The frame that lands on resume is not a 60-minute frame,
    // and must not enter the rolling average as one.
    act(() => {
      setHidden(true);
    });
    act(() => {
      setHidden(false);
    });
    act(() => {
      run(3_600_000);
      run(3_600_016.67);
    });

    expect(screen.getByText(/FPS\s+\d+/).textContent).toBe(before);

    setHidden(false);
    vi.unstubAllGlobals();
  });
});
