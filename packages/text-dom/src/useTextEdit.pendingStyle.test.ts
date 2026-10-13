import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import type { TextStyle } from '@weasel-js/text';
import {
  getOverlay,
  makeRichHarness,
  pressKey,
  placeCaretAtChar,
  dispatchBeforeInput,
  placeCaretAndSettle,
} from './testing/textEditHarness';

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

describe('useTextEdit — pending style at a collapsed caret', () => {
  it('carries a valued field, not just the boolean flags', () => {
    // The span is built through `runsToDom`, so every run field arrives
    // styled without this path enumerating them.
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => result.current.applyStyleToSelection({ fontSize: 32, baselineShift: 0.25 }));
    act(() => dispatchBeforeInput(overlay, 'B'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([
      { text: 'a' },
      { text: 'B', fontSize: 32, baselineShift: 0.25 },
    ]);
  });

  it('is abandoned when the caret moves', async () => {
    const h = makeRichHarness({ a: { text: 'abc', runs: [{ text: 'abc' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await placeCaretAndSettle(overlay, 3);
    act(() => result.current.applyStyleToSelection({ bold: true }));
    expect(result.current.pendingStyle).toEqual({ bold: true });
    await placeCaretAndSettle(overlay, 1);
    expect(result.current.pendingStyle).toEqual({});
    act(() => dispatchBeforeInput(overlay, 'X'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'aXbc' }]);
  });

  it('reports the style a control shows: node, then range, then what is armed', async () => {
    const h = makeRichHarness({ a: { text: 'ab', runs: [{ text: 'a', italic: true }, { text: 'b' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    expect(result.current.effectiveStyle).toBeNull();
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    await placeCaretAndSettle(overlay, 1);
    expect(result.current.effectiveStyle).toMatchObject({ fontSize: 16, italic: true, bold: false });
    act(() => result.current.applyStyleToSelection({ bold: true }));
    expect(result.current.effectiveStyle).toMatchObject({ fontSize: 16, italic: true, bold: true });
    act(() => result.current.commit());
    expect(result.current.effectiveStyle).toBeNull();
  });

  it('toggling the same styling twice disarms it', () => {
    const h = makeRichHarness({ a: { text: 'a', runs: [{ text: 'a' }] } });
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 1);
    act(() => { pressKey(overlay, 'b', { meta: true }); });
    expect(result.current.pendingStyle).toEqual({ bold: true });
    act(() => { pressKey(overlay, 'b', { meta: true }); });
    expect(result.current.pendingStyle).toEqual({});
  });

  it('arms a regular weight to take bold off inside a bold node', () => {
    // "Stop being bold from here on" in a bold node is a weight, not a flag:
    // the node keeps its weight and the next character is drawn at 400.
    const styles: Record<string, TextStyle> = { a: { fontSize: 16, fontWeight: 700 } };
    const h = makeRichHarness({ a: { text: 'ab', runs: [{ text: 'ab' }] } });
    h.opts.getStyle = (id) => styles[id];
    h.opts.setStyle = (id, style) => { styles[id] = style; };
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 2);
    act(() => { pressKey(overlay, 'b', { meta: true }); });
    expect(styles.a.fontWeight).toBe(700);
    expect(result.current.pendingStyle).toEqual({ fontWeight: 400 });
    act(() => dispatchBeforeInput(overlay, 'c'));
    act(() => result.current.commit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'ab' }, { text: 'c', fontWeight: 400 }]);
  });
});
