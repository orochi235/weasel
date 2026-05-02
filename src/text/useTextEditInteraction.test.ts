import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEditInteraction } from './useTextEditInteraction';
import type { UseTextEditInteractionOptions } from './useTextEditInteraction';

function makeHarness(initial: Record<string, string>) {
  const texts = { ...initial };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const commits: Array<{ id: string; text: string }> = [];
  const opts: UseTextEditInteractionOptions = {
    container,
    getText: (id) => texts[id] ?? '',
    getStyle: () => ({ fontSize: 16 }),
    getScreenPose: (id) => (id in texts ? { x: 0, y: 0, width: 200, height: 40, fontSize: 16 } : null),
    setText: (id, text) => {
      texts[id] = text;
      commits.push({ id, text });
    },
  };
  return { opts, container, commits, texts };
}

function getOverlay(container: HTMLElement): HTMLDivElement | null {
  return container.querySelector('div[contenteditable="true"]');
}

describe('useTextEditInteraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('starts with no editing id and no overlay', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    expect(result.current.editingId).toBeNull();
    expect(getOverlay(h.container)).toBeNull();
  });

  it('startEdit mounts an overlay seeded with the current text', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container);
    expect(overlay).not.toBeNull();
    expect(overlay?.innerText).toBe('hello');
    expect(result.current.isEditing('a')).toBe(true);
  });

  it('commit() writes the overlay text back via setText and tears down', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'goodbye';
    act(() => result.current.commit());
    expect(h.commits).toEqual([{ id: 'a', text: 'goodbye' }]);
    expect(result.current.editingId).toBeNull();
    expect(getOverlay(h.container)).toBeNull();
  });

  it('cancelEdit tears down without calling setText', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'goodbye';
    act(() => result.current.cancelEdit());
    expect(h.commits).toEqual([]);
    expect(getOverlay(h.container)).toBeNull();
  });

  it('Enter (no shift) commits via the overlay keydown handler', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'edited';
    act(() => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
  });

  it('Shift+Enter does not commit (handler ignores it)', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    act(() => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(h.commits).toEqual([]);
    expect(result.current.editingId).toBe('a');
  });

  it('Escape cancels via the overlay keydown handler', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'edited';
    act(() => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(h.commits).toEqual([]);
    expect(result.current.editingId).toBeNull();
  });

  it('blur commits the current overlay contents', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'on blur';
    act(() => {
      overlay.dispatchEvent(new FocusEvent('blur'));
    });
    expect(h.commits).toEqual([{ id: 'a', text: 'on blur' }]);
  });

  it('flattens pattern fills to a solid CSS color on the overlay', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ fill: { fill: 'pattern', pattern: {} as CanvasPattern } as const }),
    };
    const { result } = renderHook(() => useTextEditInteraction(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.color).toBe('rgb(0, 0, 0)');
  });

  it('uses solid fill color directly on the overlay', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ fill: { fill: 'solid', color: '#ff0000' } as const }),
    };
    const { result } = renderHook(() => useTextEditInteraction(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.color).toBe('rgb(255, 0, 0)');
  });

  it('caretColor defaults to the text color when fill is solid', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ fill: { fill: 'solid', color: '#3366cc' } as const }),
    };
    const { result } = renderHook(() => useTextEditInteraction(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('#3366cc');
  });

  it('honors an explicit caretColor override', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ fill: { fill: 'solid', color: '#000' } as const, caretColor: '#ff00ff' }),
    };
    const { result } = renderHook(() => useTextEditInteraction(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('#ff00ff');
  });

  it('caretColor falls back to #000 when fill is a pattern', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ fill: { fill: 'pattern', pattern: {} as CanvasPattern } as const }),
    };
    const { result } = renderHook(() => useTextEditInteraction(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('#000');
  });

  it('skips ::selection style injection when no selection theming is set', () => {
    const h = makeHarness({ a: 'hi' });
    const before = document.head.querySelectorAll('style').length;
    const { result } = renderHook(() => useTextEditInteraction(h.opts));
    act(() => result.current.startEdit('a'));
    expect(document.head.querySelectorAll('style').length).toBe(before);
  });

  it('injects a scoped ::selection style when selectionBackground is set, and removes it on teardown', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ selectionBackground: '#ffeb3b', selectionColor: '#000' }),
    };
    const { result } = renderHook(() => useTextEditInteraction(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const klass = Array.from(overlay.classList).find((c) => c.startsWith('weasel-text-edit-'));
    expect(klass).toBeTruthy();
    const styleEls = Array.from(document.head.querySelectorAll('style'));
    const ours = styleEls.find((s) => s.textContent?.includes(`.${klass}::selection`));
    expect(ours).toBeTruthy();
    expect(ours?.textContent).toContain('background: #ffeb3b');
    expect(ours?.textContent).toContain('color: #000');
    act(() => result.current.cancelEdit());
    const after = Array.from(document.head.querySelectorAll('style'));
    expect(after.find((s) => s.textContent?.includes(`.${klass}::selection`))).toBeUndefined();
  });

  it('does nothing when container is null', () => {
    const h = makeHarness({ a: 'hello' });
    const opts = { ...h.opts, container: null };
    const { result } = renderHook(() => useTextEditInteraction(opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(document.body)).toBeNull();
    expect(result.current.editingId).toBe('a');
  });
});
