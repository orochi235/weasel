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

  it('orders toasts newest-first in the DOM, so corner CSS keeps the newest at the edge', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => {
      q.add('info', 'one', { ttlMs: null });
      q.add('info', 'two', { ttlMs: null });
    });
    const items = screen.getAllByRole('alertdialog');
    expect(items[0].textContent).toContain('two');
    expect(items[1].textContent).toContain('one');
  });
});

describe('ToastRegion given a container', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const q = createToastQueue();
    const host = document.body.appendChild(document.createElement('div'));
    render(<ToastRegion queue={q} portalContainer={host} />);
    return { q, host };
  }

  it('renders the region inside the container', () => {
    const { q, host } = setup();
    act(() => q.add('info', 'Inside', { ttlMs: null }));
    expect(screen.getByRole('region', { name: /notifications/i }).parentElement).toBe(host);
    expect(host.textContent).toContain('Inside');
  });

  it('dismisses via the close button and auto-dismisses after the ttl', () => {
    const { q } = setup();
    act(() => {
      q.add('info', 'Clicked', { ttlMs: null });
      q.add('info', 'Timed');
    });
    fireEvent.click(screen.getAllByRole('button', { name: /dismiss/i })[1]);
    expect(screen.queryByText('Clicked')).toBeNull();
    act(() => vi.advanceTimersByTime(8100));
    expect(screen.queryByText('Timed')).toBeNull();
    expect(screen.queryByRole('region', { name: /notifications/i })).toBeNull();
  });

  it('pauses the timers while hovered', () => {
    const { q } = setup();
    act(() => q.add('info', 'Held'));
    fireEvent.pointerEnter(screen.getByRole('region', { name: /notifications/i }));
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText('Held')).toBeTruthy();
    fireEvent.pointerLeave(screen.getByRole('region', { name: /notifications/i }));
    act(() => vi.advanceTimersByTime(8100));
    expect(screen.queryByText('Held')).toBeNull();
  });

  it('returns focus to where it came from when the last toast closes', () => {
    const { q } = setup();
    const origin = document.body.appendChild(document.createElement('button'));
    origin.focus();
    act(() => q.add('info', 'Focused', { ttlMs: null }));
    act(() => screen.getByRole('button', { name: /dismiss/i }).focus());
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(document.activeElement).toBe(origin);
  });
});
