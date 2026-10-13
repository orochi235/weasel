import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { Suspense, createElement, startTransition, useState } from 'react';
import { Hang } from '@weasel-js/react/testing/abandonRender';
import { useTextEdit } from './useTextEdit';
import { makeHarness, getOverlay, appendChar, seedPlainOverlay } from './testing/textEditHarness';

describe('useTextEdit — an edit that changed nothing writes nothing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opening and closing leaves the text alone, trailing newline included', () => {
    const h = makeHarness({ a: 'abc\n' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => result.current.commit());
    expect(h.commits).toEqual([]);
    expect(h.texts.a).toBe('abc\n');
  });

  it('does not call `commit` either', () => {
    const h = makeHarness({ a: 'hi' });
    const commit = vi.fn();
    h.opts.commit = commit;
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => result.current.commit());
    expect(commit).not.toHaveBeenCalled();
  });

  it('writes nothing when the text was changed and changed back', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.textContent = 'hello';
    overlay.textContent = 'hi';
    act(() => result.current.commit());
    expect(h.commits).toEqual([]);
  });

  it('still writes an edit that changed the text', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    getOverlay(h.container)!.textContent = 'hello';
    act(() => result.current.commit());
    expect(h.commits).toEqual([{ id: 'a', text: 'hello' }]);
  });
});

describe('useTextEdit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('starts with no editing id and no overlay', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    expect(result.current.editingId).toBeNull();
    expect(getOverlay(h.container)).toBeNull();
  });

  it('startEdit mounts an overlay seeded with the current text', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container);
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toBe('hello');
    expect(result.current.isEditing('a')).toBe(true);
  });

  it('commit() writes the overlay text back via setText and tears down', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'goodbye');
    act(() => result.current.commit());
    expect(h.commits).toEqual([{ id: 'a', text: 'goodbye' }]);
    expect(result.current.editingId).toBeNull();
    expect(getOverlay(h.container)).toBeNull();
  });

  it('cancelEdit tears down without calling setText', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'goodbye');
    act(() => result.current.cancelEdit());
    expect(h.commits).toEqual([]);
    expect(getOverlay(h.container)).toBeNull();
  });

  it('Enter (no shift) commits via the overlay keydown handler', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'edited');
    act(() => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
  });

  it('leaves Enter and Escape to an open IME composition', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'edited');
    for (const key of ['Enter', 'Escape']) {
      const composing = new KeyboardEvent('keydown', { key, isComposing: true, bubbles: true, cancelable: true });
      // Safari reports the confirming key with `isComposing` already false.
      const safari = new KeyboardEvent('keydown', { key, keyCode: 229, bubbles: true, cancelable: true });
      act(() => { overlay.dispatchEvent(composing); overlay.dispatchEvent(safari); });
      expect(composing.defaultPrevented).toBe(false);
      expect(safari.defaultPrevented).toBe(false);
    }
    expect(h.commits).toEqual([]);
    expect(result.current.editingId).toBe('a');
  });

  it('Shift+Enter does not commit (handler ignores it)', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
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
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'edited');
    act(() => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(h.commits).toEqual([]);
    expect(result.current.editingId).toBeNull();
  });

  it("Escape commits instead when the editor's escape is 'commit'", () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit({ ...h.opts, escape: 'commit' }));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'edited');
    act(() => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
    expect(result.current.editingId).toBeNull();
  });

  it('blur commits the current overlay contents', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'on blur');
    act(() => {
      overlay.dispatchEvent(new FocusEvent('blur'));
    });
    expect(h.commits).toEqual([{ id: 'a', text: 'on blur' }]);
  });

  it('does nothing when container is null', () => {
    const h = makeHarness({ a: 'hello' });
    const opts = { ...h.opts, container: null };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(document.body)).toBeNull();
    expect(result.current.editingId).toBe('a');
  });

  it('mounts the overlay when the container arrives after the edit started', () => {
    const h = makeHarness({ a: 'hello' });
    const { result, rerender } = renderHook(
      ({ container }: { container: HTMLElement | null }) => useTextEdit({ ...h.opts, container }),
      { initialProps: { container: null as HTMLElement | null } },
    );
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)).toBeNull();
    rerender({ container: h.container });
    expect(getOverlay(h.container)?.textContent).toBe('hello');
  });
});

describe('useTextEdit — abandoned renders', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('commits through the committed options, not an abandoned render\'s', async () => {
    const h = makeHarness({ a: 'hi' });
    const setB = vi.fn();
    let api: ReturnType<typeof useTextEdit> | null = null;
    let abandon: () => void = () => {};
    function Host(): ReturnType<typeof createElement> {
      const [b, setB2] = useState(false);
      abandon = () => setB2(true);
      api = useTextEdit(b ? { ...h.opts, setText: setB } : h.opts);
      return createElement(Suspense, { fallback: null }, createElement(Hang, { hang: b }));
    }
    render(createElement(Host));
    act(() => api!.startEdit('a'));
    act(() => { startTransition(() => abandon()); });
    const el = getOverlay(h.container)!;
    appendChar(el, '!');
    await act(async () => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(setB).not.toHaveBeenCalled();
    expect(h.commits).toEqual([{ id: 'a', text: 'hi!' }]);
  });
});
