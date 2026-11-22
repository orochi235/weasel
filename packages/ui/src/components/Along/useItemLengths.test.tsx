import { expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useItemLengths, useRunGap } from './useItemLengths';

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

test('measures the items of a run in another document', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const doc = frame.contentDocument!;
  const root = doc.createElement('div');
  const a = doc.createElement('span');
  a.setAttribute('data-key', 'a');
  Object.defineProperty(a, 'offsetWidth', { value: 14 });
  root.append(a);
  doc.body.append(root);
  try {
    const hook = renderHook(() => useItemLengths({ current: root }, ['a'], keyOf));
    expect(hook.result.current.get('a')).toBe(14);
  } finally {
    frame.remove();
  }
});

test('reads the gap again when a theme on an ancestor changes it without resizing the root', async () => {
  const theme = document.createElement('div');
  const root = document.createElement('div');
  theme.append(root);
  document.body.append(theme);
  let gap = '4px';
  const real = window.getComputedStyle.bind(window);
  const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => (el === root ? ({ columnGap: gap } as CSSStyleDeclaration) : real(el)));
  try {
    const hook = renderHook(() => useRunGap({ current: root }));
    expect(hook.result.current).toBe(4);
    gap = '10px';
    await act(async () => {
      theme.setAttribute('data-density', 'roomy');
    });
    expect(hook.result.current).toBe(10);
  } finally {
    spy.mockRestore();
    theme.remove();
  }
});
