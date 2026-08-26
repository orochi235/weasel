import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import type { UseTextEditOptions } from './useTextEdit';
import type { StyledRun } from './runs';
import { MIXED } from './runs/rangeStyle';
import type { TextStyle } from './textStyle';

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

function pressKey(
  overlay: HTMLElement,
  key: string,
  mods: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {},
): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', {
    key,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  overlay.dispatchEvent(ev);
  return ev;
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

// jsdom implements no contenteditable editing, so it never fires `beforeinput`
// on its own — typing into the overlay silently does nothing.
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

/** Rich harness with a caller-supplied node style and screen font size, so
 *  the world→screen factor (`pose.fontSize / style.fontSize`) is testable. */
function makeTrackingHarness(
  runs: StyledRun[],
  style: TextStyle,
  screenFontSize = style.fontSize ?? 16,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const runCommits: Array<{ id: string; runs: StyledRun[] }> = [];
  const opts: UseTextEditOptions = {
    container,
    getText: () => runs.map((r) => r.text).join(''),
    getStyle: () => style,
    getScreenPose: () => ({ x: 0, y: 0, width: 200, height: 40, fontSize: screenFontSize }),
    setText: () => {},
    getRuns: () => runs,
    setRuns: (id, next) => { runCommits.push({ id, runs: next }); },
  };
  return { opts, container, runCommits };
}

describe('useTextEdit — letter-spacing on the overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('applies the node-level letterSpacing to the overlay at zoom 1', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, letterSpacing: 3 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.letterSpacing).toBe('3px');
  });

  it('scales the node-level letterSpacing by the world→screen factor', () => {
    // pose.fontSize 32 against style.fontSize 16 → zoom 2.
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, letterSpacing: 3 }, 32);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.letterSpacing).toBe('6px');
  });

  it('applies zero tracking when the style omits letterSpacing', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16 }, 32);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.letterSpacing).toBe('0px');
  });

  it('lets a run-level letterSpacing replace the overlay value rather than add to it', () => {
    // CSS `letter-spacing` is inherited, and a child's own declaration
    // *replaces* the inherited value — it is not additive. So the run span
    // must carry the run's own world value, untouched by the node's.
    const h = makeTrackingHarness(
      [{ text: 'a' }, { text: 'b', letterSpacing: 2 }],
      { fontSize: 16, letterSpacing: 3 },
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const spans = overlay.querySelectorAll('span[data-run]');
    expect(overlay.style.letterSpacing).toBe('3px');
    expect((spans[0] as HTMLSpanElement).style.letterSpacing).toBe('');
    expect((spans[1] as HTMLSpanElement).style.letterSpacing).toBe('2px');
  });
});

/** Same as `makeTrackingHarness`, but the pose declares an explicit `zoom`
 *  so every metric on it is pre-scale (world) and the overlay carries the
 *  view scale as a CSS transform instead. */
function makeZoomedHarness(runs: StyledRun[], style: TextStyle, zoom: number) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const opts: UseTextEditOptions = {
    container,
    getText: () => runs.map((r) => r.text).join(''),
    getStyle: () => style,
    getScreenPose: () => ({
      x: 10,
      y: 20,
      width: 200,
      height: 40,
      fontSize: style.fontSize ?? 16,
      zoom,
    }),
    setText: () => {},
    getRuns: () => runs,
    setRuns: () => {},
  };
  return { opts, container };
}

describe('useTextEdit — zoom-scaled overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('carries the zoom as a CSS scale anchored at the overlay origin', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16 }, 2);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.transform).toBe('scale(2)');
    expect(overlay.style.transformOrigin).toBe('0 0');
  });

  it('emits no transform at zoom 1', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16 }, 1);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.transform).toBe('none');
  });

  it('keeps x / y in screen pixels — the scale is anchored, not translated', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16 }, 2);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // The same +1 / -1 CSS-vs-canvas nudge as the unscaled path: it is a
    // screen-pixel correction and `left`/`top` are outside the scaled box.
    expect(overlay.style.left).toBe('11px');
    expect(overlay.style.top).toBe('19px');
  });

  it('leaves width / height / fontSize pre-scale — the transform does the scaling', () => {
    const h = makeZoomedHarness([{ text: 'abc' }], { fontSize: 16 }, 2);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.width).toBe('200px');
    expect(overlay.style.minHeight).toBe('40px');
    expect(overlay.style.fontSize).toBe('16px');
  });

  it('does not pre-scale letterSpacing when the pose declares a zoom', () => {
    // This is the whole point of the transform: `runsToDom` writes run-level
    // `fontSize` / `letterSpacing` in world units (`domToRuns` reads them
    // straight back), so the node level has to stay in world units too or the
    // two disagree at any zoom but 1.
    const h = makeZoomedHarness(
      [{ text: 'a' }, { text: 'b', letterSpacing: 2, fontSize: 24 }],
      { fontSize: 16, letterSpacing: 3 },
      2,
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    const spans = overlay.querySelectorAll<HTMLSpanElement>('span[data-run]');
    expect(overlay.style.letterSpacing).toBe('3px');
    expect(spans[1].style.letterSpacing).toBe('2px');
    expect(spans[1].style.fontSize).toBe('24px');
    // Asserted here too: raw world values are only correct *because* the
    // transform scales them. Drop the transform and these numbers are wrong.
    expect(overlay.style.transform).toBe('scale(2)');
  });
});

describe('useTextEdit — node-level decoration on the overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('carries node-level underline / strikethrough onto the overlay', () => {
    const h = makeTrackingHarness(
      [{ text: 'abc' }],
      { fontSize: 16, underline: true, strikethrough: true },
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.textDecoration).toBe('underline line-through');
  });

  it('sets text-decoration: none on an undecorated node', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16 });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.style.textDecoration).toBe('none');
  });

  it('does not read its own node-level decoration back as a run flag', () => {
    const h = makeTrackingHarness([{ text: 'abc' }], { fontSize: 16, underline: true });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abc' }]);
  });
});

describe('useTextEdit — decoration and tracking survive the commit path', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('an untouched edit commits the runs it started with', () => {
    const runs: StyledRun[] = [
      { text: 'a', underline: true },
      { text: 'b', strikethrough: true, letterSpacing: 2 },
      { text: 'c', letterSpacing: 0 },
    ];
    const h = makeTrackingHarness(runs, { fontSize: 16, letterSpacing: 3 }, 32);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([{ id: 'a', runs }]);
  });

  it('Cmd-B on a tracked, decorated range keeps the other keys', () => {
    const h = makeTrackingHarness(
      [{ text: 'one two', underline: true, letterSpacing: 2 }],
      { fontSize: 16 },
    );
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'one', bold: true, underline: true, letterSpacing: 2 },
      { text: ' two', underline: true, letterSpacing: 2 },
    ]);
  });
});

/**
 * `selectionchange` is fired from a task, not synchronously — jsdom copies the
 * browser here — so a test that moves the caret has to let a macrotask run
 * before the hook has observed it. Anything the hook itself writes (its own
 * style application, edit start) syncs synchronously and needs no flush.
 */
async function selectCharsAndSettle(overlay: HTMLElement, start: number, end: number): Promise<void> {
  await act(async () => {
    selectChars(overlay, start, end);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function placeCaretAndSettle(overlay: HTMLElement, charOffset: number): Promise<void> {
  await act(async () => {
    placeCaretAtChar(overlay, charOffset);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useTextEdit — range styling surface', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reports the current selection as character offsets', async () => {
    const h = makeRichHarness({ a: { text: 'abcdefg', runs: [{ text: 'abcdefg' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 0, 5);
    expect(result.current.selection).toEqual({ start: 0, end: 5 });
  });

  it('reports the initial select-all caret as the whole range', () => {
    // `startEdit`'s default caret is `selectNodeContents`, whose boundary
    // points are on the overlay element rather than in a text node. Reading
    // that as a collapsed caret at the end would put a consumer bar into
    // "edit the node, not the range" mode while the user sees a full selection.
    const h = makeRichHarness({ a: { text: 'abcdefg', runs: [{ text: 'abcdefg' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    expect(result.current.selection).toEqual({ start: 0, end: 7 });
  });

  it('reports a normalized range when the selection runs backwards', async () => {
    const h = makeRichHarness({ a: { text: 'abcdefg', runs: [{ text: 'abcdefg' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await act(async () => {
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      const text = overlay.querySelector('span[data-run]')!.firstChild as Text;
      const range = document.createRange();
      range.setStart(text, 2);
      range.setEnd(text, 6);
      sel.addRange(range);
      // A backwards drag: same boundary points, opposite anchor/focus.
      sel.setBaseAndExtent(text, 6, text, 2);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.selection).toEqual({ start: 2, end: 6 });
  });

  it('reports rangeStyle for the selection', async () => {
    const h = makeRichHarness({
      a: { text: 'abcd', runs: [{ text: 'ab', bold: true }, { text: 'cd' }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 0, 4);
    expect(result.current.rangeStyle?.bold).toBe(MIXED);
    await selectCharsAndSettle(overlay, 0, 2);
    expect(result.current.rangeStyle?.bold).toBe(true);
    await selectCharsAndSettle(overlay, 2, 4);
    // Flags are additive over the node style, so an unset one reads as false.
    expect(result.current.rangeStyle?.bold).toBe(false);
  });

  it('applies a patch to the selected range', async () => {
    const h = makeRichHarness({
      a: { text: 'abcd', runs: [{ text: 'ab', bold: true }, { text: 'cd' }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 0, 2);
    act(() => result.current.applyStyleToSelection({ underline: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'ab', bold: true, underline: true },
      { text: 'cd' },
    ]);
    expect(h.textCommits[0]).toEqual({ id: 'a', text: 'abcd' });
  });

  it('applies a non-flag patch value to the selected range', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 1, 3);
    act(() => result.current.applyStyleToSelection({ fontSize: 24, fontFamily: 'Georgia' }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'bc', fontSize: 24, fontFamily: 'Georgia' },
      { text: 'd' },
    ]);
  });

  it('reports the new rangeStyle immediately after applying a patch', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 0, 2);
    expect(result.current.rangeStyle?.underline).toBe(false);
    act(() => result.current.applyStyleToSelection({ underline: true }));
    expect(result.current.rangeStyle?.underline).toBe(true);
  });

  it('keeps the selection after a patch so a second style needs no re-select', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 0, 2);
    act(() => result.current.applyStyleToSelection({ underline: true }));
    expect(result.current.selection).toEqual({ start: 0, end: 2 });
    act(() => result.current.applyStyleToSelection({ italic: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'ab', italic: true, underline: true },
      { text: 'cd' },
    ]);
  });

  it('composes with the Cmd-B path over the same selection', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 0, 2);
    act(() => pressKey(overlay, 'b', { meta: true }));
    expect(result.current.selection).toEqual({ start: 0, end: 2 });
    expect(result.current.rangeStyle?.bold).toBe(true);
    act(() => result.current.applyStyleToSelection({ underline: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'ab', bold: true, underline: true },
      { text: 'cd' },
    ]);
  });

  it('reports a collapsed caret as an empty range at its offset', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await placeCaretAndSettle(overlay, 3);
    expect(result.current.selection).toEqual({ start: 3, end: 3 });
    // Distinguishable from "no caret at all" (null) so a consumer can route a
    // collapsed caret to the node's own TextStyle. No run is in range, so
    // there is nothing for the range reader to report.
    expect(result.current.rangeStyle).toEqual({});
  });

  it('leaves the runs alone when a patch is applied with a collapsed caret', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await placeCaretAndSettle(overlay, 3);
    act(() => result.current.applyStyleToSelection({ underline: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abcd' }]);
  });

  it('leaves the runs alone when the patch is empty', async () => {
    const h = makeRichHarness({
      a: { text: 'abcd', runs: [{ text: 'ab', bold: true }, { text: 'cd' }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await selectCharsAndSettle(overlay, 0, 4);
    act(() => result.current.applyStyleToSelection({}));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'ab', bold: true }, { text: 'cd' }]);
  });

  it('reports null selection when not editing', () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    expect(result.current.selection).toBeNull();
    expect(result.current.rangeStyle).toBeNull();
  });

  it('clears the selection surface on commit and on cancel', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    await selectCharsAndSettle(getOverlay(h.container)!, 0, 2);
    act(() => result.current.commit());
    expect(result.current.selection).toBeNull();
    expect(result.current.rangeStyle).toBeNull();
    act(() => result.current.startEdit('a'));
    act(() => result.current.cancelEdit());
    expect(result.current.selection).toBeNull();
    expect(result.current.rangeStyle).toBeNull();
  });

  it('applyStyleToSelection is a no-op when there is no active edit', () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.applyStyleToSelection({ underline: true }));
    expect(h.runCommits).toEqual([]);
    expect(h.textCommits).toEqual([]);
  });
});

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

/**
 * `startEdit` seeds a runs-less node's overlay with `overlay.innerText = …`,
 * which jsdom does not implement — the assignment lands on an expando and
 * creates no text nodes. Build the text node a browser would have built, so
 * the styling and commit paths run against a real DOM rather than against
 * the gap. Only the seeding is substituted; nothing downstream is faked.
 */
function seedPlainOverlay(overlay: HTMLElement, text: string): void {
  overlay.replaceChildren(document.createTextNode(text));
}

describe('useTextEdit — commit routes on the styling the edit produced', () => {
  it('commits runs for a node that never had any when the edit styled a range', async () => {
    const h = makeRichHarness({ a: { text: 'one two' } });
    expect(h.data.a.runs).toBeUndefined();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // The node had no runs, so init took the plain-text branch.
    expect(overlay.querySelectorAll('span[data-run]')).toHaveLength(0);
    seedPlainOverlay(overlay, 'one two');
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.applyStyleToSelection({ bold: true }));
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([{
      id: 'a',
      runs: [{ text: 'one', bold: true }, { text: ' two' }],
    }]);
    expect(h.textCommits).toEqual([{ id: 'a', text: 'one two' }]);
  });

  it('takes the setText-only path when the edit produced no styling', async () => {
    const h = makeRichHarness({ a: { text: 'one two' } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    seedPlainOverlay(overlay, 'one two');
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.commit());
    // The committed *text* isn't asserted here: the plain path reads
    // `innerText`, which jsdom doesn't implement. What this pins is the
    // routing — no pointless single-run array written back to the node.
    expect(h.runCommits).toEqual([]);
    expect(h.textCommits.map((c) => c.id)).toEqual(['a']);
  });

  it('still writes runs when an edit strips the styling a node already had', () => {
    const h = makeRichHarness({ a: { text: 'ab', runs: [{ text: 'ab', bold: true }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 2);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    // Routing on "did the edit produce styling" alone would leave the node's
    // stale bold run in place; the node's prior runs have to keep it rich.
    expect(h.runCommits).toEqual([{ id: 'a', runs: [{ text: 'ab' }] }]);
  });

  it('trims the caret-holder newline the way the plain path does', async () => {
    // A contenteditable keeps a trailing `<br>` so the caret has somewhere to
    // sit on the last line. `innerText` reports it as a trailing newline and
    // the plain-text path strips one; `domToRuns` maps it to a literal '\n'
    // and did not. The divergence was unreachable while only nodes that
    // already had runs took the rich path — styling a previously-plain node
    // reaches it, and one edit would commit text a byte longer than the same
    // edit without the styling.
    const h = makeRichHarness({ a: { text: 'one' } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    overlay.replaceChildren(document.createTextNode('one'), document.createElement('br'));
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.applyStyleToSelection({ bold: true }));
    act(() => result.current.commit());
    expect(h.textCommits).toEqual([{ id: 'a', text: 'one' }]);
    expect(h.runCommits[0].runs).toEqual([{ text: 'one', bold: true }]);
  });

  it('trims exactly one, so a deliberate trailing blank line survives', async () => {
    const h = makeRichHarness({ a: { text: 'one' } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // What the user typed ends in a newline, and the caret holder adds one
    // more on top of it.
    overlay.replaceChildren(
      document.createTextNode('one'),
      document.createElement('br'),
      document.createElement('br'),
    );
    await selectCharsAndSettle(overlay, 0, 3);
    act(() => result.current.applyStyleToSelection({ bold: true }));
    act(() => result.current.commit());
    expect(h.textCommits).toEqual([{ id: 'a', text: 'one\n' }]);
  });

  it('keeps a newline the user actually typed', () => {
    const h = makeRichHarness({ a: { text: 'a\nb', runs: [{ text: 'a\nb' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    act(() => result.current.commit());
    expect(h.textCommits).toEqual([{ id: 'a', text: 'a\nb' }]);
  });
});

describe('useTextEdit — decoration shortcuts route through the run algebra', () => {
  it('Cmd-U over plain text wraps the selected range in an underlined run', () => {
    const h = makeRichHarness({ a: { text: 'one two three', runs: [{ text: 'one two three' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 4, 7);
    act(() => pressKey(overlay, 'u', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'one ' },
      { text: 'two', underline: true },
      { text: ' three' },
    ]);
  });

  it('Cmd-U over an already-underlined range removes it', () => {
    // The whole point: the native `formatUnderline` this replaces only ever
    // turned decoration ON, and `domToRuns`' <u> flattening hid that.
    const h = makeRichHarness({
      a: { text: 'abc', runs: [{ text: 'abc', underline: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    act(() => pressKey(overlay, 'u', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abc' }]);
  });

  it('Cmd-U over a mixed range turns the whole selection on', () => {
    const h = makeRichHarness({
      a: { text: 'ab', runs: [{ text: 'a', underline: true }, { text: 'b' }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 2);
    act(() => pressKey(overlay, 'u', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'ab', underline: true }]);
  });

  it('Cmd-Shift-X toggles strikethrough; bare Cmd-X is left alone for cut', () => {
    const h = makeRichHarness({ a: { text: 'abc', runs: [{ text: 'abc' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 3);
    const cut = pressKey(overlay, 'x', { meta: true });
    expect(cut.defaultPrevented).toBe(false);
    act(() => { pressKey(overlay, 'x', { meta: true, shift: true }); });
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'abc', strikethrough: true }]);
  });

  it('Cmd-U at a collapsed caret underlines the next typed character only', () => {
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => pressKey(overlay, 'u', { meta: true }));
    act(() => dispatchBeforeInput(overlay, 'X'));
    act(() => dispatchBeforeInput(overlay, 'Y'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'X', underline: true },
      { text: 'Y' },
    ]);
  });

  it('pending underline + strikethrough share one text-decoration', () => {
    // Two assignments to `span.style.textDecoration` would replace, not merge,
    // so the second decoration would vanish on read-back.
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => pressKey(overlay, 'u', { meta: true }));
    act(() => pressKey(overlay, 'x', { meta: true, shift: true }));
    act(() => dispatchBeforeInput(overlay, 'Z'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'Z', underline: true, strikethrough: true },
    ]);
  });
});
