import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useSweepGuard } from './segmentSweep';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The pointer and key listeners still on `document`. */
function trackDocumentListeners() {
  const live = new Set<string>();
  const ids = new Map<EventListenerOrEventListenerObject, number>();
  const key = (type: string, fn: EventListenerOrEventListenerObject) => `${type}:${ids.get(fn) ?? ids.set(fn, ids.size).get(fn)}`;
  const guarded = new Set(['pointerup', 'pointercancel', 'pointerdown', 'keydown']);
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => { if (guarded.has(type)) live.add(key(type, fn!)); add(type, fn, opts); });
  vi.spyOn(document, 'removeEventListener').mockImplementation((type, fn, opts) => { live.delete(key(type, fn!)); remove(type, fn, opts); });
  return live;
}

test('a canceled sweep stops listening on the document when its bar unmounts before the release', () => {
  const live = trackDocumentListeners();
  const { result, unmount } = renderHook(() => useSweepGuard());
  result.current.swept('cancel');
  expect(live.size).toBe(4);
  unmount();
  expect(live.size).toBe(0);
});

test('a second canceled sweep replaces the first one\'s listeners rather than stacking them', () => {
  const live = trackDocumentListeners();
  const { result } = renderHook(() => useSweepGuard());
  result.current.swept('cancel');
  result.current.swept('cancel');
  expect(live.size).toBe(4);
  document.dispatchEvent(new PointerEvent('pointerdown'));
  expect(live.size).toBe(0);
  expect(result.current.sweeping()).toBe(false);
});
