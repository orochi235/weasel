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
    act(() => edit().commitEdit());
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

describe('useTextEdit ignores a blur its own onEnd causes', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function focusingSession() {
    const h = makeHarness({ a: 'hi' });
    const canvas = document.createElement('button');
    document.body.appendChild(canvas);
    h.opts.onEnd = () => canvas.focus();
    const { result } = renderHook(() => useTextEdit(h.opts));
    act(() => result.current.startEdit('a'));
    const overlay = getOverlay(h.container)!;
    expect(document.activeElement).toBe(overlay);
    overlay.textContent = 'hello';
    return { h, edit: () => result.current };
  }

  it('writes nothing for a canceled edit', () => {
    const { h, edit } = focusingSession();
    act(() => edit().cancelEdit());
    expect(h.commits).toEqual([]);
  });

  it('writes a committed edit once', () => {
    const { h, edit } = focusingSession();
    act(() => edit().commitEdit());
    expect(h.commits).toEqual([{ id: 'a', text: 'hello' }]);
  });
});

it('writes nothing for an edit another startEdit closes, when onEnd moves focus', () => {
  const h = makeHarness({ a: 'hi', b: 'yo' });
  const canvas = document.createElement('button');
  document.body.appendChild(canvas);
  h.opts.onEnd = () => canvas.focus();
  const { result } = renderHook(() => useTextEdit(h.opts));
  act(() => result.current.startEdit('a'));
  getOverlay(h.container)!.textContent = 'hello';
  act(() => result.current.startEdit('b'));
  expect(h.commits).toEqual([]);
});

it('the test harness knows no node named for an Object.prototype key', () => {
  const { opts } = makeHarness({ a: 'hi' });
  expect(opts.getScreenPose('constructor')).toBeNull();
  expect(opts.getText('constructor')).toBe('');
});
