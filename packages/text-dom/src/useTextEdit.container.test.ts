import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit } from './useTextEdit';
import { readSelectionOffsets } from './overlaySelection';
import { appendChar, getOverlay, makeRichHarness, pressKey, selectChars } from './testing/textEditHarness';

describe('useTextEdit — a container that changes mid-edit', () => {
  it('moves the open edit to the new container with what was typed, its selection, and its node style', () => {
    const styles: Record<string, TextStyle> = { a: { fontSize: 16, underline: true } };
    const h = makeRichHarness({ a: { text: 'one two', runs: [{ text: 'one two' }] } });
    h.opts.getStyle = (id) => styles[id];
    const setStyle = vi.fn((id: string, style: TextStyle) => { styles[id] = style; });
    h.opts.setStyle = setStyle;
    const onEnd = vi.fn();
    const next = document.createElement('div');
    document.body.appendChild(next);
    const { result, rerender } = renderHook(
      ({ container }: { container: HTMLElement }) => useTextEdit({ ...h.opts, container, onEnd }),
      { initialProps: { container: h.container } },
    );
    act(() => result.current.startEdit('a'));
    const first = getOverlay(h.container)!;
    selectChars(first, 4, 7);
    act(() => { pressKey(first, 'u', { meta: true }); });
    appendChar(first, '!');
    selectChars(first, 1, 3);

    rerender({ container: next });
    const moved = getOverlay(next)!;
    expect(getOverlay(h.container)).toBeNull();
    expect(moved.textContent).toBe('one two!');
    expect(readSelectionOffsets(moved)).toEqual({ start: 1, end: 3 });
    expect(result.current.editingId).toBe('a');
    expect(result.current.nodeStyle).toEqual({ fontSize: 16 });
    expect(onEnd).not.toHaveBeenCalled();

    act(() => result.current.commitEdit());
    expect(setStyle).toHaveBeenCalledWith('a', { fontSize: 16 });
    expect(h.runCommits[0].runs).toEqual([{ text: 'one ', underline: true }, { text: 'two!' }]);
    next.remove();
  });

  it('opens a later edit of the same node from the node, not from an edit canceled while it had no container', () => {
    const h = makeRichHarness({ a: { text: 'hello', runs: [{ text: 'hello' }] } });
    const { result, rerender } = renderHook(
      ({ container }: { container: HTMLElement | null }) => useTextEdit({ ...h.opts, container }),
      { initialProps: { container: h.container as HTMLElement | null } },
    );
    act(() => result.current.startEdit('a'));
    appendChar(getOverlay(h.container)!, '!');
    rerender({ container: null });
    act(() => result.current.cancelEdit());
    rerender({ container: h.container });
    act(() => result.current.startEdit('a'));
    expect(getOverlay(h.container)!.textContent).toBe('hello');
  });
});
