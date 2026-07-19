import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastRegion } from './Toast';
import { createToastQueue } from './queue';

describe('ToastRegion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders queued toasts inside a landmark region', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('success', 'Saved', { description: 'All changes stored' }));
    expect(screen.getByRole('region', { name: /notifications/i })).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('All changes stored')).toBeTruthy();
  });

  it('dismisses via the close button', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('info', 'Ephemeral'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Ephemeral')).toBeNull();
  });

  it('auto-dismisses after the default ttl', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('info', 'Timed'));
    expect(screen.getByText('Timed')).toBeTruthy();
    act(() => vi.advanceTimersByTime(8100));
    expect(screen.queryByText('Timed')).toBeNull();
  });

  it('keeps sticky toasts (ttlMs null) indefinitely', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('error', 'Sticky', { ttlMs: null }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Sticky')).toBeTruthy();
  });

  it('stacks multiple toasts and applies tone classes', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => {
      q.add('info', 'one', { ttlMs: null });
      q.add('warning', 'two', { ttlMs: null });
    });
    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
    const toastEl = screen.getByText('two').closest('[class*="toast"]');
    expect(toastEl?.className).toMatch(/toneWarning/);
  });
});
