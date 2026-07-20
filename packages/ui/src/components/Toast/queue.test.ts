import { describe, it, expect, vi } from 'vitest';
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
    expect(timed.timeout).toBe(8000);
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
    try {
      toast('plain');
      toast.error('bad');
      const visible = racQueueOf(defaultToastQueue).visibleToasts;
      // RAC's underlying ToastState queue unshifts new toasts, so the most
      // recently added toast is visibleToasts[0] (newest-on-top stacking).
      expect(visible.map((t) => t.content.tone)).toEqual(['error', 'info']);
    } finally {
      defaultToastQueue.clear();
    }
  });

  it('prunes keysById on close, so re-adding the same id fires one notification, not a stale-close extra', () => {
    const q = createToastQueue();
    q.add('info', 'first', { id: 'save-status' });
    racQueueOf(q).close(racQueueOf(q).visibleToasts[0].key);
    const notify = vi.fn();
    racQueueOf(q).subscribe(notify);
    q.add('info', 'second', { id: 'save-status' });
    expect(notify).toHaveBeenCalledTimes(1); // pre-fix: 2 (stale close + add)
    expect(racQueueOf(q).visibleToasts).toHaveLength(1);
  });

  it('dismiss(id) closes the toast previously added with that id', () => {
    const q = createToastQueue();
    q.add('info', 'first', { id: 'save-status' });
    q.dismiss('save-status');
    expect(racQueueOf(q).visibleToasts).toHaveLength(0);
  });

  it('dismiss(id) is a no-op when no toast with that id is live', () => {
    const q = createToastQueue();
    q.add('info', 'first', { id: 'save-status' });
    expect(() => q.dismiss('missing')).not.toThrow();
    expect(racQueueOf(q).visibleToasts).toHaveLength(1);
  });
});

describe('view-transition wrapping', () => {
  // jsdom has no startViewTransition, so every other test in this file
  // exercises the synchronous fallback path implicitly. lib.dom types the
  // method as always-present, so mocking/removing it needs the cast.
  const vtDoc = document as unknown as {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  it('wraps queue updates in document.startViewTransition when available', async () => {
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    vtDoc.startViewTransition = startViewTransition;
    try {
      const q = createToastQueue();
      q.add('info', 'animated');
      expect(startViewTransition).toHaveBeenCalledTimes(1);
      // The update ran inside the transition callback, not before it.
      expect(racQueueOf(q).visibleToasts).toHaveLength(1);
      // Marker class is held while the transition runs…
      expect(document.documentElement.classList.contains('wzl-toast-vt')).toBe(true);
      // …and released once `finished` settles.
      await Promise.resolve().then(() => {});
      await new Promise((r) => setTimeout(r, 0));
      expect(document.documentElement.classList.contains('wzl-toast-vt')).toBe(false);
    } finally {
      delete vtDoc.startViewTransition;
    }
  });

  it('skips the view transition under prefers-reduced-motion', () => {
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    vtDoc.startViewTransition = startViewTransition;
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    try {
      const q = createToastQueue();
      q.add('info', 'instant');
      expect(startViewTransition).not.toHaveBeenCalled();
      expect(racQueueOf(q).visibleToasts).toHaveLength(1);
    } finally {
      delete vtDoc.startViewTransition;
      vi.unstubAllGlobals();
    }
  });
});
