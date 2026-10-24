import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import {
  appendChar, getOverlay, makeHarness, makeRichHarness, placeCaretAtChar, pressKey, selectChars,
} from './testing/textEditHarness';

function type(overlay: HTMLElement, ch: string): void {
  appendChar(overlay, ch);
  act(() => { overlay.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('useTextEdit — onDraft', () => {
  it("reports the overlay's text on each input, and writes nothing until the commit", () => {
    const h = makeHarness({ a: 'hi' });
    const onDraft = vi.fn();
    const { result } = renderHook(() => useTextEdit({ ...h.opts, onDraft }));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    type(overlay, '!');
    type(overlay, '?');
    expect(onDraft.mock.calls).toEqual([['a', { text: 'hi!' }], ['a', { text: 'hi!?' }]]);
    expect(h.commits).toEqual([]);
  });

  it('carries the runs when the node has some', () => {
    const h = makeRichHarness({ a: { text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] } });
    const onDraft = vi.fn();
    const { result } = renderHook(() => useTextEdit({ ...h.opts, onDraft }));
    act(() => result.current.startEdit('a'));
    type(getOverlay(h.container)!, 'c');
    expect(onDraft).toHaveBeenLastCalledWith('a', { text: 'a bc', runs: [{ text: 'a ' }, { text: 'bc', bold: true }] });
  });

  it('reports a restyled range with no keystroke', () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const onDraft = vi.fn();
    const { result } = renderHook(() => useTextEdit({ ...h.opts, onDraft }));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 0, 2);
    act(() => { pressKey(overlay, 'b', { meta: true }); });
    expect(onDraft).toHaveBeenLastCalledWith('a', { text: 'abcd', runs: [{ text: 'ab', bold: true }, { text: 'cd' }] });
  });

  it("reports a rewritten node style with the runs, as a commit would write it", () => {
    const styles: Record<string, TextStyle> = { a: { fontSize: 16, fontStyle: 'italic' } };
    const h = makeRichHarness({ a: { text: 'one two', runs: [{ text: 'one two' }] } });
    h.opts.getStyle = (id) => styles[id];
    h.opts.setStyle = (id, style) => { styles[id] = style; };
    const onDraft = vi.fn();
    const { result } = renderHook(() => useTextEdit({ ...h.opts, onDraft }));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    selectChars(overlay, 4, 7);
    act(() => { pressKey(overlay, 'i', { meta: true }); });
    expect(onDraft).toHaveBeenLastCalledWith('a', {
      text: 'one two',
      runs: [{ text: 'one ', italic: true }, { text: 'two' }],
      style: { fontSize: 16, fontStyle: 'normal' },
    });
  });

  it('reports nothing for styling armed at a collapsed caret', () => {
    const h = makeRichHarness({ a: { text: 'abcd', runs: [{ text: 'abcd' }] } });
    const onDraft = vi.fn();
    const { result } = renderHook(() => useTextEdit({ ...h.opts, onDraft }));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    placeCaretAtChar(overlay, 2);
    act(() => { pressKey(overlay, 'b', { meta: true }); });
    expect(onDraft).not.toHaveBeenCalled();
  });
});
