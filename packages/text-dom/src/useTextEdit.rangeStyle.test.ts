import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import { MIXED } from '@weasel-js/text';
import {
  getOverlay,
  makeRichHarness,
  pressKey,
  selectCharsAndSettle,
  placeCaretAndSettle,
} from './testing/textEditHarness';

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
    // Distinguishable from "no caret at all" (null). The styling reported is
    // the run the caret sits in — what the next typed character inherits.
    expect(result.current.rangeStyle).toEqual({
      bold: false, italic: false, underline: false, strikethrough: false, overline: false,
    });
  });

  it('reports the styling of the run the caret sits in', async () => {
    const h = makeRichHarness({
      a: { text: 'abcd', runs: [{ text: 'ab', bold: true }, { text: 'cd', italic: true }] },
    });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    // Offset 2 is the boundary: the run to the LEFT is the one being typed
    // into, so bold wins over the italic run starting there.
    await placeCaretAndSettle(overlay, 2);
    expect(result.current.rangeStyle?.bold).toBe(true);
    expect(result.current.rangeStyle?.italic).toBe(false);
    // At offset 0 there is nothing to the left, so it reads rightward.
    await placeCaretAndSettle(overlay, 0);
    expect(result.current.rangeStyle?.bold).toBe(true);
  });

  it('leaves the runs alone when a patch is applied with a collapsed caret', async () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await placeCaretAndSettle(overlay, 3);
    act(() => result.current.applyStyleToSelection({ underline: true }));
    // It arms the styling for what comes next rather than restyling text the
    // user didn't select.
    expect(result.current.pendingStyle).toEqual({ underline: true });
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([]);
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
    expect(h.runCommits).toEqual([]);
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
