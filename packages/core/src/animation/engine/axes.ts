import { isPlainObject } from '../../core/isPlainObject';

/** How a value maps to the flat numbers blits moves, and back. */
export interface Axes<T> {
  count: number;
  /** Equal for two values exactly when their axes line up one for one. */
  shape: string;
  to(v: T): number[];
  from(a: ArrayLike<number>): T;
}

/** The axes of `sample`'s shape: a number, a plain array of numbers, or a plain object whose
 *  fields are all numbers. Null for any other shape, which blits cannot move. */
export function axesOf<T>(sample: T): Axes<T> | null {
  if (typeof sample === 'number') {
    return { count: 1, shape: 'number', to: (v) => [v as number], from: (a) => a[0] as T };
  }
  if (Array.isArray(sample)) {
    if (!sample.every((x) => typeof x === 'number')) return null;
    return {
      count: sample.length,
      shape: `array:${sample.length}`,
      to: (v) => (v as number[]).slice(),
      from: (a) => Array.from(a) as T,
    };
  }
  if (!isPlainObject(sample)) return null;
  const keys = Object.keys(sample).sort();
  if (keys.length === 0 || !keys.every((k) => typeof sample[k] === 'number')) return null;
  return {
    count: keys.length,
    shape: `object:${JSON.stringify(keys)}`,
    to: (v) => keys.map((k) => (v as Record<string, number>)[k]!),
    from: (a) => {
      const out: Record<string, number> = {};
      for (let i = 0; i < keys.length; i++) out[keys[i]!] = a[i]!;
      return out as T;
    },
  };
}
