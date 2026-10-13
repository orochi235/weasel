import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import type { TextStyle } from '@weasel-js/text';
import {
  getOverlay,
  makeRichHarness,
  selectChars,
  pressKey,
  placeCaretAtChar,
  dispatchBeforeInput,
} from './testing/textEditHarness';

describe('useTextEdit — superscript and subscript', () => {
  it('Cmd-Shift-= superscripts a selected range, and again clears it', () => {
    const h = makeRichHarness({ a: { text: 'x2', runs: [{ text: 'x2' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 1, 2);
    // A US layout reports Cmd+Shift+= as '+', not '='.
    act(() => { pressKey(overlay, '+', { meta: true, shift: true }); });
    expect(result.current.rangeStyle?.script).toBe('super');

    act(() => { pressKey(overlay, '+', { meta: true, shift: true }); });
    act(() => result.current.commit());
    // Off is the enum's absence, not `script: false` — so the runs coalesce
    // back to one, exactly as they were, and there is nothing to write.
    expect(h.runCommits).toEqual([]);
  });

  it('subscript replaces superscript rather than stacking with it', () => {
    const h = makeRichHarness({ a: { text: 'x2', runs: [{ text: 'x2' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 1, 2);
    act(() => { pressKey(overlay, '+', { meta: true, shift: true }); });
    act(() => { pressKey(overlay, '_', { meta: true, shift: true }); });
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'x' }, { text: '2', script: 'sub' }]);
  });

  it('superscript at a collapsed caret styles only the next typed character', () => {
    const h = makeRichHarness({ a: { text: 'x', runs: [{ text: 'x' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => { pressKey(overlay, '+', { meta: true, shift: true }); });
    act(() => dispatchBeforeInput(overlay, '2'));
    act(() => dispatchBeforeInput(overlay, 'y'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'x' },
      { text: '2', script: 'super' },
      { text: 'y' },
    ]);
  });
});

describe('useTextEdit — lowering a flag the node sets', () => {
  it('takes the flag off the overlay root, where every run would inherit it', () => {
    const styles: Record<string, TextStyle> = {
      a: { fontSize: 16, underline: true, fontStyle: 'italic' },
    };
    const h = makeRichHarness({ a: { text: 'one two', runs: [{ text: 'one two' }] } });
    h.opts.getStyle = (id) => styles[id];
    h.opts.setStyle = (id, style) => { styles[id] = style; };
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(overlay.style.textDecoration).toBe('underline');
    expect(overlay.style.fontStyle).toBe('italic');

    selectChars(overlay, 4, 7);
    act(() => { pressKey(overlay, 'u', { meta: true }); });
    expect(overlay.style.textDecoration).toBe('none');

    selectChars(overlay, 4, 7);
    act(() => { pressKey(overlay, 'i', { meta: true }); });
    expect(overlay.style.fontStyle).not.toBe('italic');
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

  it('Cmd-B reads bold off the weight: a light range turns bold, a heavy one turns regular', () => {
    const h = makeRichHarness({
      a: { text: 'ab', runs: [{ text: 'a', fontWeight: 300 }, { text: 'b', fontWeight: 800 }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 1);
    act(() => pressKey(overlay, 'b', { meta: true }));
    selectChars(overlay, 1, 2);
    act(() => pressKey(overlay, 'b', { meta: true }));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'a', bold: true }, { text: 'b' }]);
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
