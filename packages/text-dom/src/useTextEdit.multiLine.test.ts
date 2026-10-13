import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import { makeHarness, getOverlay, appendChar, seedPlainOverlay } from './testing/textEditHarness';

describe('useTextEdit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('multi-line navigation', () => {
    it('seeds the overlay with multi-line text and preserves newlines through commit', () => {
      const h = makeHarness({ a: 'first line\nsecond line\nthird line' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      expect(overlay.textContent).toBe('first line\nsecond line\nthird line');
      appendChar(overlay, '!');
      act(() => result.current.commit());
      expect(h.commits).toEqual([{ id: 'a', text: 'first line\nsecond line\nthird line!' }]);
    });

    it('Shift+Enter is not preempted, so the browser would insert a newline', () => {
      const h = makeHarness({ a: 'one' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      const ev = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        overlay.dispatchEvent(ev);
      });
      expect(ev.defaultPrevented).toBe(false);
      expect(h.commits).toEqual([]);
      expect(result.current.editingId).toBe('a');
    });

    it('places initial selection across all content (so typing replaces it)', () => {
      const h = makeHarness({ a: 'line one\nline two' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      const sel = window.getSelection()!;
      expect(sel.rangeCount).toBe(1);
      const range = sel.getRangeAt(0);
      expect(range.startContainer).toBe(overlay);
      expect(range.endContainer).toBe(overlay);
      expect(range.startOffset).toBe(0);
      expect(range.endOffset).toBe(overlay.childNodes.length);
    });

    it('repositioning the caret to mid-document does not affect commit text', () => {
      const h = makeHarness({ a: 'alpha\nbeta\ngamma' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      const r = document.createRange();
      r.setStart(overlay, 0);
      r.collapse(true);
      sel.addRange(r);
      appendChar(overlay, '!');
      act(() => {
        overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      });
      expect(h.commits).toEqual([{ id: 'a', text: 'alpha\nbeta\ngamma!' }]);
    });

    it('strips a single trailing newline on commit', () => {
      const h = makeHarness({ a: 'x' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      seedPlainOverlay(overlay, 'edited\n');
      act(() => result.current.commit());
      expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
    });

    it('preserves a blank line in the middle of the document', () => {
      const h = makeHarness({ a: 'top\n\nbottom' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      expect(overlay.textContent).toBe('top\n\nbottom');
      appendChar(overlay, '!');
      act(() => result.current.commit());
      expect(h.commits).toEqual([{ id: 'a', text: 'top\n\nbottom!' }]);
    });
  });
});
