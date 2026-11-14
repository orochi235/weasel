import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FpsMeter } from './FpsMeter';
import s from './FpsMeter.module.css';

describe('FpsMeter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders an FPS label', () => {
    render(<FpsMeter />);
    expect(screen.getByText('FPS')).toBeInTheDocument();
  });

  /* The label and the rate are separate elements so the rate can hold a fixed
     width; a text query spanning both would go back to matching one box. */
  const rate = (): HTMLElement => {
    const el = document.querySelector(`.${s.value}`);
    if (!el) throw new Error('no rate readout');
    return el as HTMLElement;
  };

  test('accepts an extra class name', () => {
    const { container } = render(<FpsMeter className="is-mine" />);
    expect((container.firstChild as HTMLElement).className).toBe(`${s.meter} is-mine`);
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
    expect(rate().textContent).toBe('60');

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
    const before = rate().textContent;

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

    expect(rate().textContent).toBe(before);

    setHidden(false);
    vi.unstubAllGlobals();
  });
});
