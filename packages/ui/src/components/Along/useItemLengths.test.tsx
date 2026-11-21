import { expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useItemLengths } from './useItemLengths';

const keyOf = (el: Element): string | null => el.getAttribute('data-key');

test('lets go of the length of an item once no key names it and it is no longer drawn', () => {
  const root = document.createElement('div');
  const item = (key: string): HTMLElement => {
    const el = document.createElement('span');
    el.setAttribute('data-key', key);
    Object.defineProperty(el, 'offsetWidth', { value: 10 });
    return el;
  };
  root.append(item('a'), item('b'));
  const hook = renderHook(({ keys }) => useItemLengths({ current: root }, keys, keyOf), { initialProps: { keys: ['a', 'b'] } });
  expect([...hook.result.current.keys()]).toEqual(['a', 'b']);
  root.replaceChildren(item('c'));
  hook.rerender({ keys: ['c'] });
  expect([...hook.result.current.keys()]).toEqual(['c']);
});

test('keeps the length of an item off the line while a key still names it', () => {
  const root = document.createElement('div');
  const a = document.createElement('span');
  a.setAttribute('data-key', 'a');
  Object.defineProperty(a, 'offsetWidth', { value: 12 });
  root.append(a);
  const hook = renderHook(({ keys }) => useItemLengths({ current: root }, keys, keyOf), { initialProps: { keys: ['a'] } });
  root.replaceChildren();
  hook.rerender({ keys: ['a'] });
  expect(hook.result.current.get('a')).toBe(12);
});

test('stops watching an item that leaves while the keys stay the same', () => {
  const watched = new Set<Element>();
  vi.stubGlobal('ResizeObserver', class {
    observe(el: Element) { watched.add(el); }
    unobserve(el: Element) { watched.delete(el); }
    disconnect() { watched.clear(); }
  });
  try {
    const root = document.createElement('div');
    const more = (): HTMLElement => {
      const el = document.createElement('span');
      el.setAttribute('data-key', 'more');
      return el;
    };
    const first = more();
    root.append(first);
    const ref = { current: root };
    const hook = renderHook(() => useItemLengths(ref, ['a'], keyOf));
    const second = more();
    root.replaceChildren(second);
    hook.rerender();
    expect([...watched]).toEqual([second]);
  } finally {
    vi.unstubAllGlobals();
  }
});
