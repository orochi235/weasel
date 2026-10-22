import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import { appendChar, getOverlay, makeHarness, makeRichHarness } from './testing/textEditHarness';

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
});
