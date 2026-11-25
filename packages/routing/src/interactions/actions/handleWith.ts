import type { OngoingHandle } from './invoker';

type Hooks = Partial<Pick<OngoingHandle, 'onMove' | 'onEnd'>>;

/** `handle` with the hooks in `over` replaced where it has them, every other member read live from it and each method
 *  called on `handle` itself: a copy would split the state of a handle that keeps it on `this`, and drop a class
 *  instance's methods. */
export function handleWith(handle: OngoingHandle, over: Hooks): OngoingHandle {
  const bound = new Map<PropertyKey, { of: unknown; fn: unknown }>();
  return new Proxy(handle, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key, target);
      if (Object.hasOwn(over, key) && value !== undefined) return over[key as keyof Hooks];
      if (typeof value !== 'function') return value;
      let hit = bound.get(key);
      if (hit?.of !== value) {
        hit = { of: value, fn: (value as (...args: unknown[]) => unknown).bind(target) };
        bound.set(key, hit);
      }
      return hit.fn;
    },
  });
}
