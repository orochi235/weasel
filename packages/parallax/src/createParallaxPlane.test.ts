import { describe, it, expect, vi } from 'vitest';
import { createParallaxPlane } from './createParallaxPlane';

describe('createParallaxPlane', () => {
  it('merges a patch over the current opts', () => {
    const plane = createParallaxPlane({ pan: 0.5, zoom: 0.2, anchor: { x: 1, y: 2 } });
    plane.set({ pan: 0.8 });
    expect(plane.get()).toEqual({ pan: 0.8, zoom: 0.2, anchor: { x: 1, y: 2 } });
  });

  it('hands back a new object per write, so a reader can compare by reference', () => {
    const plane = createParallaxPlane({ pan: 0.5 });
    const before = plane.get();
    plane.set({ pan: 0.6 });
    expect(plane.get()).not.toBe(before);
    expect(before.pan).toBe(0.5);
  });

  it('notifies subscribers on every write until they unsubscribe', () => {
    const plane = createParallaxPlane({ pan: 0.5 });
    const fn = vi.fn();
    const off = plane.subscribe(fn);
    plane.set({ pan: 0.1 });
    off();
    plane.set({ pan: 0.2 });
    expect(fn).toHaveBeenCalledOnce();
  });
});
