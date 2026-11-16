import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWindowEvent } from './useWindowEvent';

describe('useWindowEvent', () => {
  it('calls the latest handler, and stops on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ fn }) => useWindowEvent('hashchange', fn), { initialProps: { fn: first } });
    window.dispatchEvent(new Event('hashchange'));
    rerender({ fn: second });
    window.dispatchEvent(new Event('hashchange'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new Event('hashchange'));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('listens only while enabled', () => {
    const fn = vi.fn();
    const { rerender } = renderHook(({ on }) => useWindowEvent('popstate', fn, { enabled: on }), { initialProps: { on: false } });
    window.dispatchEvent(new Event('popstate'));
    expect(fn).not.toHaveBeenCalled();
    rerender({ on: true });
    window.dispatchEvent(new Event('popstate'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('hears a captured event before the document does', () => {
    const order: string[] = [];
    const doc = () => order.push('document');
    document.addEventListener('pointerdown', doc, true);
    renderHook(() => useWindowEvent('pointerdown', () => order.push('window'), { capture: true }));
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.removeEventListener('pointerdown', doc, true);
    expect(order).toEqual(['window', 'document']);
  });
});
