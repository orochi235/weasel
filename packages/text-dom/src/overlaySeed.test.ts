import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { StyledRun } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import type { UseTextEditOptions } from './textEditTypes';

function makeHarness(text: string, runs?: StyledRun[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const texts: string[] = [];
  const runCommits: StyledRun[][] = [];
  const opts: UseTextEditOptions = {
    container,
    getText: () => text,
    getStyle: () => ({ fontSize: 16 }),
    getScreenPose: () => ({ x: 0, y: 0, width: 200, height: 40, fontSize: 16 }),
    setText: (_id, t) => { texts.push(t); },
    ...(runs ? { getRuns: () => runs, setRuns: (_id, r) => { runCommits.push(r); } } : {}),
  };
  return { opts, container, texts, runCommits };
}

/** Type `ch` at the very start of the overlay's text, as the hook's own `beforeinput` path does. */
function typeAtStart(container: HTMLElement, ch: string): void {
  const overlay = container.querySelector<HTMLElement>('[contenteditable]')!;
  const first = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT).nextNode()!;
  const range = document.createRange();
  range.setStart(first, 0);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  first.textContent = ch + first.textContent;
}

describe('useTextEdit: text that ends in a line break', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  for (const text of ['abc\n', 'abc\n\n', 'abc ', 'abc\r\n']) {
    it(`keeps the ending of ${JSON.stringify(text)} through an edit elsewhere`, () => {
      const h = makeHarness(text);
      const { result } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      typeAtStart(h.container, 'x');
      act(() => result.current.commit());
      expect(h.texts.map((t) => JSON.stringify(t))).toEqual([JSON.stringify(`x${text}`)]);
    });
  }

  it('keeps it when the overlay is seeded from runs', () => {
    const h = makeHarness('ab\n', [{ text: 'a' }, { text: 'b\n', bold: true }]);
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    typeAtStart(h.container, 'x');
    act(() => result.current.commit());
    expect(h.runCommits).toEqual([[{ text: 'xa' }, { text: 'b\n', bold: true }]]);
  });

  it('still drops the one newline a browser adds after a typed line break', () => {
    const h = makeHarness('abc');
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = h.container.querySelector<HTMLElement>('[contenteditable]')!;
    overlay.textContent = 'abc\n\n';
    act(() => result.current.commit());
    expect(h.texts).toEqual(['abc\n']);
  });
});
