import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { useNotified, type Notifier } from './useNotified';

function source() {
  const fns = new Set<() => void>();
  const subscribe: Notifier['subscribe'] = (fn) => { fns.add(fn); return () => { fns.delete(fn); }; };
  return { subscribe, emit: () => { for (const fn of [...fns]) fn(); }, size: () => fns.size };
}

describe('useNotified', () => {
  it('re-renders for a change made after its render and before its effect subscribed', () => {
    const s = source();
    function Reader() {
      return <span>{useNotified(s)}</span>;
    }
    function Writer() {
      useLayoutEffect(() => { s.emit(); }, []);
      return null;
    }
    render(<><Reader /><Writer /></>);
    expect(screen.getByText('1')).toBeTruthy();
    act(() => s.emit());
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('lets go of its own listener on unmount', () => {
    const s = source();
    function Reader() {
      useNotified(s);
      return null;
    }
    const view = render(<Reader />);
    const held = s.size();
    view.unmount();
    expect(s.size()).toBe(held - 1);
  });
});
