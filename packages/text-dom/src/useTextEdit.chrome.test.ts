import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import { getOverlay, makeRichHarness, selectChars, selectCharsAndSettle } from './testing/textEditHarness';

/**
 * Focus leaving the overlay for a *control that styles the overlay* — a
 * character bar's size field, a color popover — is the one case where blur
 * must not mean "done editing". Without this, clicking the control the
 * feature exists for is what destroys the thing being edited.
 */
describe('useTextEdit — editing chrome', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function makeChromeHarness() {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const chrome = document.createElement('div');
    const field = document.createElement('input');
    chrome.appendChild(field);
    document.body.appendChild(chrome);
    return {
      ...h,
      chrome,
      field,
      opts: { ...h.opts, isEditorChrome: (el: Element) => chrome.contains(el) },
    };
  }

  function blurTo(overlay: HTMLElement, relatedTarget: Element | null): void {
    overlay.dispatchEvent(new FocusEvent('blur', { relatedTarget }));
  }

  it('does not commit when focus moves into editing chrome', () => {
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => blurTo(getOverlay(h.container)!, h.field));
    expect(result.current.editingId).toBe('a');
    expect(h.textCommits).toEqual([]);
  });

  it('still commits when focus moves anywhere else', () => {
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    act(() => blurTo(getOverlay(h.container)!, elsewhere));
    expect(result.current.editingId).toBeNull();
  });

  it('commits on a blur with no related target', () => {
    // Clicking the page background, or tabbing out of the document.
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => blurTo(getOverlay(h.container)!, null));
    expect(result.current.editingId).toBeNull();
  });

  it('commits on a pointerdown outside the overlay and outside chrome', () => {
    // Once focus has moved into chrome the overlay can no longer blur, so
    // `blur` alone would leave no way to finish the edit by clicking away.
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => blurTo(getOverlay(h.container)!, h.field));
    expect(result.current.editingId).toBe('a');
    const elsewhere = document.createElement('div');
    document.body.appendChild(elsewhere);
    act(() => {
      elsewhere.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(result.current.editingId).toBeNull();
  });

  it('does not commit on a pointerdown inside chrome', () => {
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => {
      h.field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(result.current.editingId).toBe('a');
  });

  it('does not commit on a pointerdown inside the overlay', () => {
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => {
      getOverlay(h.container)!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(result.current.editingId).toBe('a');
  });

  it('keeps reporting the range while the selection sits in chrome', async () => {
    // The DOM selection follows focus into the control. Reporting `null`
    // here would tell a consumer bar "collapsed caret" — and a bar that
    // routes a collapsed caret to the node's own style would then write the
    // patch to the wrong target, silently.
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 1, 3);
    expect(result.current.selection).toEqual({ start: 1, end: 3 });
    await act(async () => {
      window.getSelection()!.removeAllRanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.selection).toEqual({ start: 1, end: 3 });
  });

  it('does not pull the document selection back into the overlay from chrome', async () => {
    // Browsers route editing commands by *selection*, not by focus. Restoring
    // the range inside the contenteditable while a bar field has focus means
    // the Enter that committed that field also runs `insertParagraph` over the
    // restored range — the styled text is replaced by a line break. Observed
    // in Chrome, not reproducible from unit tests alone.
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 1, 3);
    h.field.focus();
    await act(async () => {
      window.getSelection()!.removeAllRanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => result.current.applyStyleToSelection({ underline: true }));
    const sel = window.getSelection()!;
    expect(
      sel.rangeCount === 0 || !overlay.contains(sel.getRangeAt(0).startContainer),
    ).toBe(true);
    // The range is still the one it will style next — remembered, not read.
    expect(result.current.selection).toEqual({ start: 1, end: 3 });
  });

  it('republishes rangeStyle after a patch made from chrome', async () => {
    // The DOM selection is in the control, so re-reading it after the write
    // finds nothing and leaves the consumer showing pre-patch styling — the
    // field snaps back to the old value the moment it commits a new one.
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 1, 3);
    h.field.focus();
    await act(async () => {
      window.getSelection()!.removeAllRanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => result.current.applyStyleToSelection({ fontSize: 34 }));
    expect(result.current.rangeStyle?.fontSize).toBe(34);
  });

  it('keeps the caret when a chrome *button* has focus', () => {
    // Bold, then italic, then underline is one flow over one selection, and
    // clicking a toolbar button does take focus. A button turns keystrokes
    // into clicks rather than editing commands, so the range is safe.
    const h = makeChromeHarness();
    const button = document.createElement('button');
    h.chrome.appendChild(button);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 1, 3);
    button.focus();
    act(() => result.current.applyStyleToSelection({ bold: true }));
    const sel = window.getSelection()!;
    expect(sel.rangeCount).toBe(1);
    expect(overlay.contains(sel.getRangeAt(0).startContainer)).toBe(true);
  });

  it('styles the remembered range when the DOM selection has left the overlay', async () => {
    const h = makeChromeHarness();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 1, 3);
    await act(async () => {
      window.getSelection()!.removeAllRanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => result.current.applyStyleToSelection({ underline: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'bc', underline: true },
      { text: 'd' },
    ]);
  });
});
