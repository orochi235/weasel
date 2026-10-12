/**
 * The click a completed drag would otherwise deliver to its source is
 * swallowed by a one-shot capture listener. These tests are about that
 * listener's lifetime. jsdom synthesizes no click from pointer events, so
 * each click here is dispatched by hand: "no click followed the drag" is
 * simply not dispatching one.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDragHandle } from './pointerDrag';

beforeAll(() => {
  if (!('elementFromPoint' in document)) {
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, writable: true, value: () => null });
  }
});

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function firePointer(type: string, init: Partial<PointerEvent> = {}) {
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, pointerType: 'mouse', button: 0, ...init });
  document.dispatchEvent(ev);
}

/** Press on a fresh row and drag it past the threshold. */
function startDrag() {
  const { result, unmount } = renderHook(() => useDragHandle(() => ({ kind: 'item', ids: ['a'] })));
  const row = document.createElement('div');
  document.body.appendChild(row);
  const onClick = vi.fn();
  row.addEventListener('click', onClick);
  result.current.onPointerDown({
    pointerType: 'mouse', button: 0, pointerId: 1, clientX: 0, clientY: 0, currentTarget: row, target: row,
  } as unknown as React.PointerEvent<HTMLElement>);
  firePointer('pointermove', { clientX: 50, clientY: 0 });
  return { row, onClick, unmount };
}

describe('useDragHandle click guard', () => {
  it('swallows the click that arrives with the release', () => {
    const { row, onClick } = startDrag();
    firePointer('pointerup', { clientX: 50, clientY: 0 });
    row.click();
    expect(onClick).not.toHaveBeenCalled();
    row.remove();
  });

  it('lets the next click through when the release brought none', () => {
    const { row, onClick } = startDrag();
    // Released over something else: the browser sends the row no click.
    firePointer('pointerup', { clientX: 50, clientY: 300 });
    vi.runAllTimers();
    row.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    row.remove();
  });

  it('lets the next click through after the drag is canceled', () => {
    const { row, onClick } = startDrag();
    firePointer('pointercancel');
    row.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    row.remove();
  });

  // Unmounting the hook aborts the session with the button still down. The row
  // here outlives it, as an element owned by a parent does.
  it('swallows the click of a release that follows an aborted drag', () => {
    const { row, onClick, unmount } = startDrag();
    unmount();
    firePointer('pointerup', { clientX: 50, clientY: 0 });
    row.click();
    expect(onClick).not.toHaveBeenCalled();
    row.remove();
  });

  it('lets the next click through when an aborted drag is released elsewhere', () => {
    const { row, onClick, unmount } = startDrag();
    unmount();
    firePointer('pointerup', { clientX: 50, clientY: 300 });
    vi.runAllTimers();
    row.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    row.remove();
  });

  it('lets a click through when an aborted drag is followed by a new press', () => {
    const { row, onClick, unmount } = startDrag();
    unmount();
    firePointer('pointerdown');
    row.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    row.remove();
  });
});
