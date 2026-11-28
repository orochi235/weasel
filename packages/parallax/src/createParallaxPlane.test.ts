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

  it('answers opts that cannot be edited in place, so every change goes through set and is heard', () => {
    const plane = createParallaxPlane({ pan: { x: 0, y: 1 }, anchor: { x: 1, y: 2 } });
    const heard = vi.fn();
    plane.subscribe(heard);
    const got = plane.get() as { pan: { x: number; y: number }; anchor: { x: number; y: number } };
    expect(() => { got.pan.x = 1; }).toThrow(TypeError);
    expect(() => { got.anchor.y = 5; }).toThrow(TypeError);
    expect(() => { (got as { zoom?: number }).zoom = 2; }).toThrow(TypeError);
    expect(plane.get()).toEqual({ pan: { x: 0, y: 1 }, anchor: { x: 1, y: 2 } });
    plane.set({ pan: { x: 1, y: 1 } });
    expect(heard).toHaveBeenCalledTimes(1);
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

  it('leaves pan where it is on a patch whose pan is undefined, as pan has no default to fall back to', () => {
    const plane = createParallaxPlane({ pan: 0.5, zoom: 0.2 });
    const fn = vi.fn();
    plane.subscribe(fn);
    plane.set({ pan: undefined, zoom: 0.3 });
    expect(plane.get()).toEqual({ pan: 0.5, zoom: 0.3 });
    plane.set({ pan: undefined });
    expect(fn).toHaveBeenCalledOnce();
  });
});
