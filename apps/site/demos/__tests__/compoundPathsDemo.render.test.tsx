import { act, fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompoundPathsDemo } from '../CompoundPathsDemo';

describe('CompoundPathsDemo', () => {
  it('mounts without throwing and renders a canvas', () => {
    // Smoke-only: catches JSX-parse-error / import-time crash regressions.
    // The demo is otherwise exercised manually; this test just guards the
    // module's render path so a future bad edit fails loudly here.
    const { container } = render(<CompoundPathsDemo />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.isConnected).toBe(true);
  });
});

describe('the compound paths honk', () => {
  it('stays up its full time after a second honk', () => {
    vi.useFakeTimers();
    try {
      const { queryByText, getByRole } = render(<CompoundPathsDemo />);
      const toast = () => queryByText('HONK', { selector: 'div' });
      const honk = getByRole('button', { name: 'honk' });
      act(() => { fireEvent.click(honk); });
      act(() => { vi.advanceTimersByTime(600); });
      act(() => { fireEvent.click(honk); });
      act(() => { vi.advanceTimersByTime(600); });
      expect(toast()).not.toBeNull();
      act(() => { vi.advanceTimersByTime(400); });
      expect(toast()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
