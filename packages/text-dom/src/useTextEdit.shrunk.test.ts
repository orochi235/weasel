/** Counterexamples `useTextEdit.pbt.test.ts` shrank to: styling armed at a caret that did not land as written. */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { StyledRun } from '@weasel-js/text';
import { dispatchBeforeInput, getOverlay, makeRichHarness, placeCaretAtChar, pressKey } from './testing/textEditHarness';
import { useTextEdit } from './useTextEdit';

function editAtEnd(runs: StyledRun[]) {
  const text = runs.map((r) => r.text).join('');
  const h = makeRichHarness({ a: { text, runs } });
  const { result } = renderHook(() => useTextEdit(h.opts));
  act(() => result.current.startEdit('a'));
  const overlay = getOverlay(h.container)!;
  placeCaretAtChar(overlay, text.length);
  return { h, edit: () => result.current, overlay };
}

describe('useTextEdit armed style (shrunk)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('takes subscript off the next character at the end of a subscript run', () => {
    const { h, edit, overlay } = editAtEnd([{ text: 'a', script: 'sub' }]);
    act(() => { pressKey(overlay, '-', { meta: true, shift: true }); });
    act(() => dispatchBeforeInput(overlay, 'b'));
    act(() => edit().commit());
    expect(h.runCommits[0]!.runs).toEqual([{ text: 'a', script: 'sub' }, { text: 'b' }]);
  });

  it('takes bold off the next character at the end of a bold run, and shows it off', () => {
    const { h, edit, overlay } = editAtEnd([{ text: 'a', bold: true }]);
    act(() => { pressKey(overlay, 'b', { meta: true }); });
    expect(edit().effectiveStyle?.bold).toBe(false);
    act(() => dispatchBeforeInput(overlay, 'b'));
    act(() => edit().commit());
    expect(h.runCommits[0]!.runs).toEqual([{ text: 'a', bold: true }, { text: 'b' }]);
  });

  it('arms a weight over a bold run as a write would, dropping the flag', () => {
    const { h, edit, overlay } = editAtEnd([{ text: 'a', bold: true }]);
    act(() => edit().applyStyleToSelection({ fontWeight: 700 }));
    act(() => dispatchBeforeInput(overlay, 'a'));
    act(() => edit().commit());
    expect(h.runCommits[0]!.runs).toEqual([{ text: 'a', bold: true }, { text: 'a', fontWeight: 700 }]);
  });

  it('takes a weight off with bold armed after a light run', () => {
    const { h, edit, overlay } = editAtEnd([{ text: 'a', fontWeight: 300 }]);
    act(() => { pressKey(overlay, 'b', { meta: true }); });
    expect(edit().effectiveStyle?.bold).toBe(true);
    act(() => dispatchBeforeInput(overlay, 'b'));
    act(() => edit().commit());
    expect(h.runCommits[0]!.runs).toEqual([{ text: 'a', fontWeight: 300 }, { text: 'b', bold: true }]);
  });

  it('takes the null fill of an unfilled run off the next character', () => {
    const { h, edit, overlay } = editAtEnd([{ text: 'a', fill: null }]);
    placeCaretAtChar(overlay, 0);
    act(() => edit().applyStyleToSelection({ fill: undefined }));
    act(() => dispatchBeforeInput(overlay, 'a'));
    act(() => edit().commit());
    expect(h.runCommits[0]!.runs).toEqual([{ text: 'a' }, { text: 'a', fill: null }]);
  });
});
