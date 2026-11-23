import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import {
  dispatchBeforeInput, getOverlay, makeRichHarness, placeCaretAtChar, pressKey, selectChars,
} from './testing/textEditHarness';

function superNode() {
  const styles: Record<string, TextStyle> = { a: { fontSize: 16, script: 'super' } };
  const h = makeRichHarness({ a: { text: 'one two', runs: [{ text: 'one two' }] } });
  h.opts.getStyle = (id) => styles[id];
  h.opts.setStyle = (id, style) => { styles[id] = style; };
  const { result } = renderHook(() => useTextEdit(h.opts));
  act(() => result.current.startEdit('a'));
  return { h, result, styles, overlay: getOverlay(h.container)! };
}

describe('useTextEdit — a script the node sets', () => {
  it('Cmd+Shift+= over part of superscript text takes it off that part', () => {
    const { h, result, styles, overlay } = superNode();
    selectChars(overlay, 4, 7);
    act(() => pressKey(overlay, '=', { meta: true, shift: true }));
    act(() => result.current.commitEdit());
    expect(styles.a).toEqual({ fontSize: 16 });
    expect(h.runCommits[0].runs).toEqual([{ text: 'one ', script: 'super' }, { text: 'two' }]);
  });

  it('Cmd+Shift+- over superscript text sets it subscript', () => {
    const { h, result, overlay } = superNode();
    selectChars(overlay, 4, 7);
    act(() => pressKey(overlay, '-', { meta: true, shift: true }));
    act(() => result.current.commitEdit());
    expect(h.runCommits[0].runs).toEqual([{ text: 'one ' }, { text: 'two', script: 'sub' }]);
  });

  it('Cmd+Shift+= at a caret in superscript text types the next character unscripted', () => {
    const { h, result, styles, overlay } = superNode();
    placeCaretAtChar(overlay, 7);
    act(() => pressKey(overlay, '=', { meta: true, shift: true }));
    expect(result.current.effectiveStyle?.script).toBeUndefined();
    act(() => dispatchBeforeInput(overlay, 'X'));
    act(() => result.current.commitEdit());
    expect(styles.a).toEqual({ fontSize: 16 });
    expect(h.runCommits[0].runs).toEqual([{ text: 'one two', script: 'super' }, { text: 'X' }]);
  });
});
