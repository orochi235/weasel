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
    // RAC's underlying ToastState queue unshifts new toasts, so
    // visibleToasts is newest-first: 'sticky' (added last) is index 0,
    // 'timed' (added first) is index 1.
    const q = createToastQueue();
    q.add('info', 'timed');
    q.add('info', 'sticky', { ttlMs: null });
    const [sticky, timed] = racQueueOf(q).visibleToasts;
    expect(timed.timer).toBeDefined();
    expect(sticky.timer).toBeUndefined();
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
