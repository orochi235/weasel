import { describe, it, expect, vi } from 'vitest';
import { createLongPressStore, type PendingLongPress } from './longPressState';

const pending = (over: Partial<PendingLongPress> = {}): PendingLongPress => ({
  pointerId: 1,
  pointerType: 'touch',
  client: { x: 50, y: 50 },
  local: { x: 40, y: 30 },
  world: { x: 4, y: 3 },
  viewId: null,
  startedAt: 1000,
  duration: 500,
  armed: true,
  ...over,
});

describe('createLongPressStore', () => {
  it('starts empty, with zero progress', () => {
    const s = createLongPressStore();
    expect(s.get()).toBeNull();
    expect(s.progress(5000)).toBe(0);
  });

  it('reports progress 0→1 across the hold, clamped at both ends', () => {
    const s = createLongPressStore();
    s.set(pending());
    expect(s.progress(900)).toBe(0);
    expect(s.progress(1000)).toBe(0);
    expect(s.progress(1250)).toBeCloseTo(0.5);
    expect(s.progress(1500)).toBe(1);
    expect(s.progress(9000)).toBe(1);
  });

  it('notifies subscribers on set and on clear, and not on a redundant clear', () => {
    const s = createLongPressStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set(pending());
    s.set(null);
    s.set(null);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    s.set(pending());
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
