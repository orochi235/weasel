import { isPlainObject } from '../../core/isPlainObject';

/** How a value maps to the flat numbers blits moves, and back. */
export interface Axes<T> {
  count: number;
  /** Equal for two values exactly when their axes line up one for one. */
  shape: string;
  to(v: T): number[];
  /** The value whose `count` axes start at `at` in `a`. */
  from(a: ArrayLike<number>, at?: number): T;
  /** `v` with `delta` added axis by axis. */
  add(v: T, delta: ArrayLike<number>): T;
  /** Puts `v`'s axes into `out` from `at`. */
  write(v: T, out: Float64Array | Float32Array | number[], at: number): void;
}

type Fields = Record<string, number>;
type Buffer = Float64Array | Float32Array | number[];

/**
 * `add` and `write` for an object of up to four fields, each field read where the code names
 * it. A loop over the keys reads every field at one place, and a place that sees a second key
 * falls back to a lookup several times slower: 10k reads of `{ x, y }` took 1.4 ms through the
 * loop and 0.9 ms through hand-written axes.
 */
function fieldByField(keys: readonly string[]): { add(v: Fields, d: ArrayLike<number>): Fields; write(v: Fields, o: Buffer, at: number): void } | null {
  const [a, b, c, e] = keys as [string, string, string, string];
  switch (keys.length) {
    case 1: return {
      add: (v, d) => ({ [a]: v[a]! + d[0]! }),
      write: (v, o, at) => { o[at] = v[a]!; },
    };
    case 2: return {
      add: (v, d) => ({ [a]: v[a]! + d[0]!, [b]: v[b]! + d[1]! }),
      write: (v, o, at) => { o[at] = v[a]!; o[at + 1] = v[b]!; },
    };
    case 3: return {
      add: (v, d) => ({ [a]: v[a]! + d[0]!, [b]: v[b]! + d[1]!, [c]: v[c]! + d[2]! }),
      write: (v, o, at) => { o[at] = v[a]!; o[at + 1] = v[b]!; o[at + 2] = v[c]!; },
    };
    case 4: return {
      add: (v, d) => ({ [a]: v[a]! + d[0]!, [b]: v[b]! + d[1]!, [c]: v[c]! + d[2]!, [e]: v[e]! + d[3]! }),
      write: (v, o, at) => { o[at] = v[a]!; o[at + 1] = v[b]!; o[at + 2] = v[c]!; o[at + 3] = v[e]!; },
    };
    default: return null;
  }
}

/** The axes of `sample`'s shape: a number, a plain array of numbers, or a plain object whose
 *  fields are all numbers. Null for any other shape, which blits cannot move. */
export function axesOf<T>(sample: T): Axes<T> | null {
  if (typeof sample === 'number') {
    return {
      count: 1,
      shape: 'number',
      to: (v) => [v as number],
      from: (a, at = 0) => a[at] as T,
      add: (v, delta) => ((v as number) + delta[0]!) as T,
      write: (v, out, at) => { out[at] = v as number; },
    };
  }
  if (Array.isArray(sample)) {
    if (!sample.every((x) => typeof x === 'number')) return null;
    return {
      count: sample.length,
      shape: `array:${sample.length}`,
      to: (v) => (v as number[]).slice(),
      from: (a, at = 0) => {
        const out = new Array<number>(sample.length);
        for (let i = 0; i < out.length; i++) out[i] = a[at + i]!;
        return out as T;
      },
      add: (v, delta) => {
        const out = new Array<number>(sample.length);
        for (let i = 0; i < out.length; i++) out[i] = (v as number[])[i]! + delta[i]!;
        return out as T;
      },
      write: (v, out, at) => {
        for (let i = 0; i < sample.length; i++) out[at + i] = (v as number[])[i]!;
      },
    };
  }
  if (!isPlainObject(sample)) return null;
  const keys = Object.keys(sample).sort();
  if (keys.length === 0 || !keys.every((k) => typeof sample[k] === 'number')) return null;
  return {
    count: keys.length,
    shape: `object:${JSON.stringify(keys)}`,
    to: (v) => keys.map((k) => (v as Record<string, number>)[k]!),
    from: (a, at = 0) => {
      const out: Record<string, number> = {};
      for (let i = 0; i < keys.length; i++) out[keys[i]!] = a[at + i]!;
      return out as T;
    },
    ...(fieldByField(keys) ?? {
      add: (v: Fields, delta: ArrayLike<number>) => {
        const out: Fields = {};
        for (let i = 0; i < keys.length; i++) out[keys[i]!] = v[keys[i]!]! + delta[i]!;
        return out;
      },
      write: (v: Fields, out: Buffer, at: number) => {
        for (let i = 0; i < keys.length; i++) out[at + i] = v[keys[i]!]!;
      },
    }) as unknown as Pick<Axes<T>, 'add' | 'write'>,
  };
}
