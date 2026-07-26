import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import type { UseTextEditOptions } from './useTextEdit';
import type { StyledRun } from './runs';

function makeHarness(initial: Record<string, string>) {
  const texts = { ...initial };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const commits: Array<{ id: string; text: string }> = [];
  const opts: UseTextEditOptions = {
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
    expect(overlay?.innerText).toBe('hello');
    expect(result.current.isEditing('a')).toBe(true);
  });

  it('commit() writes the overlay text back via setText and tears down', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
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
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'goodbye';
    act(() => result.current.cancelEdit());
    expect(h.commits).toEqual([]);
    expect(getOverlay(h.container)).toBeNull();
  });

  it('Enter (no shift) commits via the overlay keydown handler', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
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
    overlay.innerText = 'edited';
    act(() => {
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(h.commits).toEqual([]);
    expect(result.current.editingId).toBeNull();
  });

  it('blur commits the current overlay contents', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
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
      getStyle: () => ({ fill: { fill: 'pattern', pattern: { id: 'test-tex' } } as const }),
    };
    const { result } = renderHook(() => useTextEdit(opts));
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
    const { result } = renderHook(() => useTextEdit(opts));
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
    const { result } = renderHook(() => useTextEdit(opts));
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
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('#ff00ff');
  });

  it('caretColor falls back to #000 when fill is a pattern', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ fill: { fill: 'pattern', pattern: { id: 'test-tex' } } as const }),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.caretColor).toBe('#000');
  });

  it('injects a default ::selection style derived from caret color', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ fill: { fill: 'solid', color: '#3366cc' } as const }),
    };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const klass = Array.from(overlay.classList).find((c) => c.startsWith('weasel-text-edit-'));
    const ours = Array.from(document.head.querySelectorAll('style')).find((s) =>
      s.textContent?.includes(`.${klass}::selection`),
    );
    expect(ours?.textContent).toContain('background: color-mix(in srgb, #3366cc 25%, transparent)');
  });

  it('skips ::selection injection when selectionBackground is "none"', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ selectionBackground: 'none' }),
    };
    const before = document.head.querySelectorAll('style').length;
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    expect(document.head.querySelectorAll('style').length).toBe(before);
  });

  it('injects a scoped ::selection style when selectionBackground is set, and removes it on teardown', () => {
    const h = makeHarness({ a: 'hi' });
    const opts = {
      ...h.opts,
      getStyle: () => ({ selectionBackground: '#ffeb3b', selectionColor: '#000' }),
    };
    const { result } = renderHook(() => useTextEdit(opts));
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

  describe('multi-line navigation', () => {
    it('seeds the overlay with multi-line text and preserves newlines through commit', () => {
      const h = makeHarness({ a: 'first line\nsecond line\nthird line' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      expect(overlay.innerText).toBe('first line\nsecond line\nthird line');
      act(() => result.current.commit());
      expect(h.commits).toEqual([{ id: 'a', text: 'first line\nsecond line\nthird line' }]);
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
      act(() => {
        overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      });
      expect(h.commits).toEqual([{ id: 'a', text: 'alpha\nbeta\ngamma' }]);
    });

    it('strips a single trailing newline from innerText on commit', () => {
      const h = makeHarness({ a: 'x' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      overlay.innerText = 'edited\n';
      act(() => result.current.commit());
      expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
    });

    it('preserves a blank line in the middle of the document', () => {
      const h = makeHarness({ a: 'top\n\nbottom' });
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      expect(overlay.innerText).toBe('top\n\nbottom');
      act(() => result.current.commit());
      expect(h.commits).toEqual([{ id: 'a', text: 'top\n\nbottom' }]);
    });
  });

  it('does nothing when container is null', () => {
    const h = makeHarness({ a: 'hello' });
    const opts = { ...h.opts, container: null };
    const { result } = renderHook(() => useTextEdit(opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(document.body)).toBeNull();
    expect(result.current.editingId).toBe('a');
  });
});

function makeRichHarness(initial: Record<string, { text: string; runs?: StyledRun[] }>) {
  const data = { ...initial };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const textCommits: Array<{ id: string; text: string }> = [];
  const runCommits: Array<{ id: string; runs: StyledRun[] }> = [];
  const opts: UseTextEditOptions = {
    container,
    getText: (id) => data[id]?.text ?? '',
    getStyle: () => ({ fontSize: 16 }),
    getScreenPose: (id) => (id in data ? { x: 0, y: 0, width: 200, height: 40, fontSize: 16 } : null),
    setText: (id, text) => { data[id] = { ...data[id], text }; textCommits.push({ id, text }); },
    getRuns: (id) => data[id]?.runs,
    setRuns: (id, runs) => { data[id] = { ...data[id], runs }; runCommits.push({ id, runs }); },
  };
  return { opts, container, data, textCommits, runCommits };
}

describe('useTextEdit — rich-text init and commit', () => {
  it('builds a styled span overlay when getRuns returns runs', () => {
    const h = makeRichHarness({
      a: { text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const spans = overlay.querySelectorAll('span[data-run]');
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toBe('a ');
    expect((spans[1] as HTMLSpanElement).style.fontWeight).toBe('700');
  });

  it('falls back to plain innerText when getRuns is omitted or returns nothing', () => {
    const h = makeHarness({ a: 'hello' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.querySelectorAll('span[data-run]')).toHaveLength(0);
    expect(overlay.innerText).toBe('hello');
  });

  it('commit walks DOM via domToRuns and calls setRuns + setText', () => {
    const h = makeRichHarness({
      a: { text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const tail = document.createElement('span');
    tail.setAttribute('data-run', '');
    tail.textContent = ' c';
    overlay.appendChild(tail);
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([{
      id: 'a',
      runs: [{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }],
    }]);
    expect(h.textCommits).toEqual([{ id: 'a', text: 'a b c' }]);
  });

  it('commit on a plain-text edit (no setRuns) only fires setText', () => {
    const h = makeHarness({ a: 'hi' });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.innerText = 'edited';
    act(() => result.current.commit());
    expect(h.commits).toEqual([{ id: 'a', text: 'edited' }]);
  });
});

function selectChars(overlay: HTMLElement, start: number, end: number): void {
  const range = document.createRange();
  function findPos(target: number): { node: Node; offset: number } | null {
    let remaining = target;
    const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      if (remaining <= node.data.length) return { node, offset: remaining };
      remaining -= node.data.length;
      node = walker.nextNode() as Text | null;
    }
    return null;
  }
  const a = findPos(start)!;
  const b = findPos(end)!;
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function pressKey(overlay: HTMLElement, key: string, mods: { meta?: boolean; ctrl?: boolean } = {}): void {
  overlay.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    bubbles: true,
    cancelable: true,
  }));
}

function placeCaretAtChar(overlay: HTMLElement, charOffset: number): void {
  const range = document.createRange();
  let remaining = charOffset;
  const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (remaining <= node.data.length) {
      range.setStart(node, remaining);
      range.setEnd(node, remaining);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    remaining -= node.data.length;
    node = walker.nextNode() as Text | null;
  }
}

function dispatchBeforeInput(overlay: HTMLElement, data: string): void {
  const ev = new InputEvent('beforeinput', {
    inputType: 'insertText',
    data,
    bubbles: true,
    cancelable: true,
  });
  overlay.dispatchEvent(ev);
}

describe('useTextEdit — Cmd-B/I with collapsed caret (pending style)', () => {
  it('Cmd-B at caret then typing wraps the next character in a bold run', () => {
    const h = makeRichHarness({ a: { text: 'abc', runs: [{ text: 'abc' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 3);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => dispatchBeforeInput(overlay, 'X'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'abc' },
      { text: 'X', bold: true },
    ]);
  });

  it('pending style stacks bold + italic', () => {
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => pressKey(overlay, 'i', { meta: true }));
    act(() => dispatchBeforeInput(overlay, 'Y'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'Y', bold: true, italic: true },
    ]);
  });

  it('pending style clears after one inserted character', () => {
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => dispatchBeforeInput(overlay, 'X'));
    act(() => dispatchBeforeInput(overlay, 'Y'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'X', bold: true },
      { text: 'Y' },
    ]);
  });
});

describe('useTextEdit — Cmd-B/I on range selection', () => {
  it('Cmd-B over plain text wraps the selected range in a bold run', () => {
    const h = makeRichHarness({ a: { text: 'one two three', runs: [{ text: 'one two three' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 4, 7);  // 'two'
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'one ' },
      { text: 'two', bold: true },
      { text: ' three' },
    ]);
  });

  it('Cmd-B over an already-bold range removes the bold flag', () => {
    const h = makeRichHarness({
      a: {
        text: 'one two three',
        runs: [{ text: 'one ' }, { text: 'two', bold: true }, { text: ' three' }],
      },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 4, 7);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'one two three' }]);
  });

  it('Cmd-I toggles italic independently of bold', () => {
    const h = makeRichHarness({ a: { text: 'abc', runs: [{ text: 'abc', bold: true }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    act(() => pressKey(overlay, 'i', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abc', bold: true, italic: true }]);
  });

  it('Ctrl-B (non-Mac) toggles bold on the selection', () => {
    const h = makeRichHarness({ a: { text: 'xyz', runs: [{ text: 'xyz' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    act(() => pressKey(overlay, 'b', { ctrl: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'xyz', bold: true }]);
  });
});
