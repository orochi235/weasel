import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LabContext, type LabContextValue } from '../../lab/LabContext';
import { useLensRemeasure } from './useLensRemeasure';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('has each source look again, and the host render, when the system color scheme flips', () => {
  const lists: { listener: (() => void) | null } = { listener: null };
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: false,
    addEventListener: (_: string, fn: () => void) => {
      lists.listener = fn;
    },
    removeEventListener: () => {
      lists.listener = null;
    },
  }));
  const source = { remeasure: vi.fn() };
  const rerender = vi.fn();
  const body = document.createElement('div');
  const sources = [source];
  function Host() {
    useLensRemeasure(sources, body, rerender);
    return null;
  }
  const { unmount } = render(
    <LabContext.Provider value={{ trials: [], mode: 'auto' } as unknown as LabContextValue}>
      <Host />
    </LabContext.Provider>,
  );
  source.remeasure.mockClear();
  expect(lists.listener).not.toBeNull();
  lists.listener?.();
  expect(source.remeasure).toHaveBeenCalledTimes(1);
  expect(rerender).toHaveBeenCalledTimes(1);
  unmount();
  expect(lists.listener).toBeNull();
});

it('has each source look again, and the host render, when the page around the lab scrolls', () => {
  const source = { remeasure: vi.fn() };
  const rerender = vi.fn();
  const body = document.createElement('div');
  const outer = document.createElement('div');
  outer.append(body);
  document.body.append(outer);
  const sources = [source];
  function Host() {
    useLensRemeasure(sources, body, rerender);
    return null;
  }
  const { unmount } = render(
    <LabContext.Provider value={{ trials: [], mode: 'dark' } as unknown as LabContextValue}>
      <Host />
    </LabContext.Provider>,
  );
  source.remeasure.mockClear();
  outer.dispatchEvent(new Event('scroll'));
  document.dispatchEvent(new Event('scroll'));
  expect(source.remeasure).toHaveBeenCalledTimes(2);
  expect(rerender).toHaveBeenCalledTimes(2);
  unmount();
  outer.dispatchEvent(new Event('scroll'));
  expect(source.remeasure).toHaveBeenCalledTimes(2);
  outer.remove();
});

it('has each source look again, and the host render, when the lab body resizes with no window event', () => {
  const observers: { fire: () => void; observed: Element[]; disconnected: boolean }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly record: (typeof observers)[number];
      constructor(callback: () => void) {
        this.record = { fire: callback, observed: [], disconnected: false };
        observers.push(this.record);
      }
      observe(el: Element) {
        this.record.observed.push(el);
      }
      unobserve() {}
      disconnect() {
        this.record.disconnected = true;
      }
    },
  );
  const source = { remeasure: vi.fn() };
  const rerender = vi.fn();
  const body = document.createElement('div');
  const sources = [source];
  function Host() {
    useLensRemeasure(sources, body, rerender);
    return null;
  }
  const { unmount } = render(
    <LabContext.Provider value={{ trials: [], mode: 'dark' } as unknown as LabContextValue}>
      <Host />
    </LabContext.Provider>,
  );
  const watcher = observers.find((o) => o.observed.includes(body));
  expect(watcher).toBeDefined();
  source.remeasure.mockClear();
  watcher?.fire();
  expect(rerender).not.toHaveBeenCalled();
  watcher?.fire();
  expect(source.remeasure).toHaveBeenCalledTimes(1);
  expect(rerender).toHaveBeenCalledTimes(1);
  unmount();
  expect(watcher?.disconnected).toBe(true);
});
