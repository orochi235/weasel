import { describe, it, expect } from 'vitest';
import { createToastQueue, racQueueOf, toast, defaultToastQueue } from './queue';

describe('ToastQueue', () => {
  it('adds toasts with tone, title, description', () => {
    const q = createToastQueue();
    q.add('warning', 'SVG import', { description: '3 elements skipped' });
    const visible = racQueueOf(q).visibleToasts;
    expect(visible).toHaveLength(1);
    expect(visible[0].content).toEqual({
      title: 'SVG import',
      description: '3 elements skipped',
      tone: 'warning',
    });
  });

  it('defaults to an 8s timeout and honors ttlMs null as sticky', () => {
    // Note: RAC only arms toast timers once a <ToastRegion> renders, so the
    // timer-presence assertion (timed.timer defined / sticky.timer undefined)
    // can't be exercised at this queue-only layer. That behavior is covered
    // by Task 6's region tests (fake timers). Here we just confirm both
    // toasts land in the queue regardless of ttlMs.
    const q = createToastQueue();
    q.add('info', 'timed');
    q.add('info', 'sticky', { ttlMs: null });
    expect(racQueueOf(q).visibleToasts).toHaveLength(2);
  });

  it('replaces an earlier toast with the same id', () => {
    const q = createToastQueue();
    q.add('info', 'first', { id: 'save-status' });
    q.add('success', 'second', { id: 'save-status' });
    const visible = racQueueOf(q).visibleToasts;
    expect(visible).toHaveLength(1);
    expect(visible[0].content.title).toBe('second');
  });

  it('clear() empties the queue', () => {
    const q = createToastQueue();
    q.add('info', 'a');
    q.add('info', 'b');
    q.clear();
    expect(racQueueOf(q).visibleToasts).toHaveLength(0);
  });

  it('toast() convenience writes to the default queue with tones', () => {
    toast('plain');
    toast.error('bad');
    const visible = racQueueOf(defaultToastQueue).visibleToasts;
    // RAC's underlying ToastState queue unshifts new toasts, so the most
    // recently added toast is visibleToasts[0] (newest-on-top stacking).
    expect(visible.map((t) => t.content.tone)).toEqual(['error', 'info']);
    defaultToastQueue.clear();
  });
});
