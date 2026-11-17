/**
 * One painter entry per distinct set of options, so registering the same
 * painter twice hands the registry the entry it already holds rather than a
 * second one under the same id, which it refuses.
 */
type Level<T> = { strong: Map<unknown, Level<T>>; weak: WeakMap<object, Level<T>>; value?: T };

const level = <T>(): Level<T> => ({ strong: new Map(), weak: new WeakMap() });

/** A memo keyed on a tuple: object keys are held weakly, the rest strongly. */
export function entryMemo<T>(): (keys: readonly unknown[], build: () => T) => T {
  const root = level<T>();
  return (keys, build) => {
    let at = root;
    for (const key of keys) {
      const weak = key !== null && (typeof key === 'object' || typeof key === 'function');
      let next = weak ? at.weak.get(key as object) : at.strong.get(key);
      if (next === undefined) {
        next = level<T>();
        if (weak) at.weak.set(key as object, next);
        else at.strong.set(key, next);
      }
      at = next;
    }
    return (at.value ??= build());
  };
}
