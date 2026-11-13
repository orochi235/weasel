/**
 * The overlay's own undo: a restyle, an armed character, and the node style a flag rewrite holds are each a step,
 * typing at one caret is one step, and each step puts the selection back as it stood. Real keys against Chromium's
 * stack are in `overlayHistory.browser.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import { domToRuns } from './domRuns';
import { readSelectionOffsets } from './overlaySelection';
import {
  dispatchBeforeInput, getOverlay, makeRichHarness, placeCaretAtChar, pressKey, selectChars,
} from './testing/textEditHarness';

/** Mod+Z and Shift+Mod+Z off an Apple platform, which jsdom is not. */
const undo = (el: HTMLElement) => act(() => { pressKey(el, 'z', { ctrl: true }); });
const redo = (el: HTMLElement) => act(() => { pressKey(el, 'z', { ctrl: true, shift: true }); });

function open(text: string, style: TextStyle = {}) {
  const h = makeRichHarness({ a: { text, runs: [{ text }] } });
  h.opts.getStyle = () => ({ fontSize: 16, ...style });
  h.opts.commit = (id, edit) => { h.data[id] = { text: edit.text, runs: edit.runs }; };
  const hook = renderHook(() => useTextEdit(h.opts));
  act(() => hook.result.current.startEdit('a', { caret: 0 }));
  return { h, hook, el: getOverlay(h.container)! };
}

describe('useTextEdit — undo inside the edit', () => {
  it('takes a restyle back and puts the range it styled back under the selection', () => {
    const { hook, el } = open('abcd');
    selectChars(el, 1, 3);
    act(() => hook.result.current.toggleStyle('bold'));
    expect(domToRuns(el)).toEqual([{ text: 'a' }, { text: 'bc', bold: true }, { text: 'd' }]);
    placeCaretAtChar(el, 4);
    undo(el);
    expect(domToRuns(el)).toEqual([{ text: 'abcd' }]);
    expect(readSelectionOffsets(el)).toEqual({ start: 1, end: 3 });
    expect(hook.result.current.selection).toEqual({ start: 1, end: 3 });
    redo(el);
    expect(domToRuns(el)).toEqual([{ text: 'a' }, { text: 'bc', bold: true }, { text: 'd' }]);
  });

  it('undoes typing at one caret as one step, and what was typed before a restyle after it', () => {
    const { hook, el } = open('ab');
    placeCaretAtChar(el, 2);
    act(() => { dispatchBeforeInput(el, 'c'); dispatchBeforeInput(el, 'd'); });
    selectChars(el, 0, 1);
    act(() => hook.result.current.toggleStyle('italic'));
    undo(el);
    expect(domToRuns(el)).toEqual([{ text: 'abcd' }]);
    undo(el);
    expect(domToRuns(el)).toEqual([{ text: 'ab' }]);
    expect(readSelectionOffsets(el)).toEqual({ start: 2, end: 2 });
    act(() => hook.result.current.commit());
  });

  it('undoes a character typed under an armed style', () => {
    const { el } = open('ab');
    placeCaretAtChar(el, 2);
    act(() => { pressKey(el, 'b', { ctrl: true }); });
    act(() => dispatchBeforeInput(el, 'X'));
    expect(domToRuns(el)).toEqual([{ text: 'ab' }, { text: 'X', bold: true }]);
    undo(el);
    expect(domToRuns(el)).toEqual([{ text: 'ab' }]);
  });

  it('puts back the node style a flag rewrite held, so the commit writes none', () => {
    const { h, hook, el } = open('abcd', { fontStyle: 'italic' });
    h.opts.setStyle = () => {};
    selectChars(el, 1, 3);
    act(() => hook.result.current.applyStyleToSelection({ italic: false }));
    expect(hook.result.current.nodeStyle).not.toBeNull();
    undo(el);
    expect(hook.result.current.nodeStyle).toBeNull();
    expect(el.style.fontStyle).toBe('italic');
    let written: unknown = 'nothing';
    h.opts.commit = (_id, edit) => { written = edit; };
    act(() => hook.result.current.commit());
    expect(written).toBe('nothing');
  });

  it('steps nothing for a styling armed and left unused', () => {
    const { el } = open('ab');
    placeCaretAtChar(el, 2);
    act(() => dispatchBeforeInput(el, 'c'));
    act(() => { pressKey(el, 'b', { ctrl: true }); });
    undo(el);
    expect(domToRuns(el)).toEqual([{ text: 'ab' }]);
  });
});
