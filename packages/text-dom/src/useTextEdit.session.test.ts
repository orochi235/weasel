import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTextEdit } from './useTextEdit';
import { getOverlay, makeHarness } from './testing/textEditHarness';

function session(initial: Record<string, string>) {
  const h = makeHarness(initial);
  const events: string[] = [];
  h.opts.onStart = (id) => events.push(`start ${id}`);
  h.opts.onEnd = (id) => events.push(`end ${id} "${h.texts[id]}"`);
  const { result } = renderHook(() => useTextEdit(h.opts));
  return { h, events, edit: () => result.current };
}

describe('useTextEdit reports the edit opening and closing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reports the start from the call that opens the edit', () => {
    const { events, edit } = session({ a: 'hi' });
    act(() => {
      edit().startEdit('a');
      expect(events).toEqual(['start a']);
    });
  });

  it('reports the end after the commit is written', () => {
    const { h, events, edit } = session({ a: 'hi' });
    act(() => edit().startEdit('a'));
    getOverlay(h.container)!.textContent = 'hello';
    act(() => edit().commit());
    expect(events).toEqual(['start a', 'end a "hello"']);
  });

  it('reports the end of a canceled edit', () => {
    const { events, edit } = session({ a: 'hi' });
    act(() => edit().startEdit('a'));
    act(() => edit().cancelEdit());
    expect(events).toEqual(['start a', 'end a "hi"']);
  });

  it('reports the end of an edit Escape closes', async () => {
    const { h, events, edit } = session({ a: 'hi' });
    act(() => edit().startEdit('a'));
    await act(async () => {
      getOverlay(h.container)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(events).toEqual(['start a', 'end a "hi"']);
  });

  it('closes one edit before opening another over it', () => {
    const { events, edit } = session({ a: 'hi', b: 'yo' });
    act(() => edit().startEdit('a'));
    act(() => edit().startEdit('b'));
    expect(events).toEqual(['start a', 'end a "hi"', 'start b']);
  });

  it('reports an edit started twice once', () => {
    const { events, edit } = session({ a: 'hi' });
    act(() => edit().startEdit('a'));
    act(() => edit().startEdit('a', { caret: 0 }));
    expect(events).toEqual(['start a']);
  });
});
