import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLabHistory } from './useLabHistory';

interface S {
  n: number;
  s: string;
}
const INITIAL: S = { n: 1, s: 'a' };

/** Focuses a control and sends it the undo accelerator, the way a browser does. */
function undoFrom(element: HTMLElement) {
  document.body.append(element);
  element.focus();
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }));
  });
}

const input = (type: string) => Object.assign(document.createElement('input'), { type });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useLabHistory', () => {
  it('starts with nothing to undo', () => {
    const { result } = renderHook(() => useLabHistory(INITIAL));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toEqual(INITIAL);
  });

  it('undoes and redoes an edit', () => {
    const { result } = renderHook(() => useLabHistory(INITIAL));
    act(() => result.current.update({ n: 2, s: 'a' }, 'n'));
    expect(result.current.state.n).toBe(2);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.state.n).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.state.n).toBe(2);
  });

  it('collapses a drag on one control into a single undo step', () => {
    const { result } = renderHook(() => useLabHistory(INITIAL));
    act(() => {
      for (let n = 2; n <= 12; n += 1) result.current.update({ n, s: 'a' }, 'n');
    });
    expect(result.current.state.n).toBe(12);

    // One undo returns to before the drag, not to n = 11.
    act(() => result.current.undo());
    expect(result.current.state.n).toBe(1);
    expect(result.current.canUndo).toBe(false);
  });

  it('keeps edits to different controls as separate steps', () => {
    const { result } = renderHook(() => useLabHistory(INITIAL));
    act(() => result.current.update({ n: 2, s: 'a' }, 'n'));
    act(() => result.current.update({ n: 2, s: 'b' }, 's'));

    act(() => result.current.undo());
    expect(result.current.state).toEqual({ n: 2, s: 'a' });
    act(() => result.current.undo());
    expect(result.current.state).toEqual({ n: 1, s: 'a' });
  });

  it.each([
    ['a range', () => input('range')],
    ['a checkbox', () => input('checkbox')],
    ['a color swatch', () => input('color')],
    ['a select', () => document.createElement('select')],
  ])('undoes on the accelerator while %s has focus, since it has no undo of its own', (_what, make) => {
    const { result } = renderHook(() => useLabHistory(INITIAL));
    act(() => result.current.update({ n: 2, s: 'a' }, 'n'));
    undoFrom(make());
    expect(result.current.state.n).toBe(1);
  });

  it.each([
    ['a text field', () => input('text')],
    ['a number field', () => input('number')],
    ['a textarea', () => document.createElement('textarea')],
  ])('leaves the accelerator to %s, which undoes its own typing', (_what, make) => {
    const { result } = renderHook(() => useLabHistory(INITIAL));
    act(() => result.current.update({ n: 2, s: 'a' }, 'n'));
    undoFrom(make());
    expect(result.current.state.n).toBe(2);
  });

  it('does not push an entry when nothing changed', () => {
    const { result } = renderHook(() => useLabHistory(INITIAL));
    act(() => result.current.update(INITIAL, 'n'));
    expect(result.current.canUndo).toBe(false);
  });
});
