import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import {
  dispatchBeforeInput, getOverlay, makeRichHarness, placeCaretAtChar, pressKey, selectChars,
} from './testing/textEditHarness';

function italicNode(runs: { text: string; italic?: boolean }[], withSetStyle: boolean) {
  const styles: Record<string, TextStyle> = { a: { fontSize: 16, fontStyle: 'italic' } };
  const h = makeRichHarness({ a: { text: runs.map((r) => r.text).join(''), runs } });
  h.opts.getStyle = (id) => styles[id];
  if (withSetStyle) h.opts.setStyle = (id, style) => { styles[id] = style; };
  const { result } = renderHook(() => useTextEdit(h.opts));
  act(() => result.current.startEdit('a'));
  return { h, result, styles, overlay: getOverlay(h.container)! };
}

describe('useTextEdit — an upright run in italic text', () => {
  for (const withSetStyle of [false, true]) {
    const how = withSetStyle ? 'with setStyle' : 'without setStyle';

    it(`Cmd+I at a caret in the upright run types the next character italic (${how})`, () => {
      const { h, result, overlay } = italicNode([{ text: 'ab', italic: false }], withSetStyle);
      placeCaretAtChar(overlay, 2);
      act(() => pressKey(overlay, 'i', { meta: true }));
      act(() => dispatchBeforeInput(overlay, 'X'));
      act(() => result.current.commitEdit());
      expect(h.runCommits[0].runs).toEqual([{ text: 'ab', italic: false }, { text: 'X' }]);
    });

    it(`Cmd+I over the upright run sets it italic (${how})`, () => {
      const { h, result, overlay } = italicNode([{ text: 'ab', italic: false }, { text: 'cd' }], withSetStyle);
      selectChars(overlay, 0, 2);
      act(() => pressKey(overlay, 'i', { meta: true }));
      act(() => result.current.commitEdit());
      expect(h.runCommits[0].runs).toEqual([{ text: 'abcd' }]);
    });

    it(`Cmd+I at a caret in italic text types the next character upright (${how})`, () => {
      const { h, result, overlay, styles } = italicNode([{ text: 'ab' }], withSetStyle);
      placeCaretAtChar(overlay, 2);
      act(() => pressKey(overlay, 'i', { meta: true }));
      act(() => dispatchBeforeInput(overlay, 'X'));
      act(() => result.current.commitEdit());
      expect(styles.a.fontStyle).toBe('italic');
      expect(h.runCommits[0].runs).toEqual([{ text: 'ab' }, { text: 'X', italic: false }]);
    });
  }

  it('Cmd+I over part of italic text sets only that part upright, leaving an upright run elsewhere alone', () => {
    const { h, result, overlay, styles } = italicNode([{ text: 'ab', italic: false }, { text: 'cdef' }], true);
    selectChars(overlay, 4, 6);
    act(() => pressKey(overlay, 'i', { meta: true }));
    act(() => result.current.commitEdit());
    expect(styles.a.fontStyle).toBe('italic');
    expect(h.runCommits[0].runs).toEqual([
      { text: 'ab', italic: false }, { text: 'cd' }, { text: 'ef', italic: false },
    ]);
  });
});
