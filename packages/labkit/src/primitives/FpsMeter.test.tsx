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
});
