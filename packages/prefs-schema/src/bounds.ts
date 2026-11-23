import { endlessAllows } from '@weasel-js/quantity';
import type { PrefNumber } from './schema';

/** Reads a value held beside a number leaf, by the path a condition there would name. */
export type PrefBoundReader = (path: string) => unknown;

/**
 * A number leaf's bound where its value is held: `undefined` for none. Asked
 * per holder, so each scene node a panel edits can have its own.
 */
export type PrefBoundAt = (read: PrefBoundReader) => number | undefined;

/**
 * `leaf` with its `minAt` and `maxAt` read against `read` and folded into
 * `min` and `max`, whichever is tighter. A bound that reads as NaN is no bound. A bound read is held inside the declared
 * ones, and a `maxAt` below the `min` gives way to it, so `min` never passes `max`.
 * The leaf itself when it has neither.
 */
export function prefBoundedNumber(leaf: PrefNumber, read: PrefBoundReader): PrefNumber {
  const { minAt, maxAt, ...rest } = leaf;
  if (minAt === undefined && maxAt === undefined) return leaf;
  const within = (n: number | undefined): number | undefined =>
    n === undefined || Number.isNaN(n) ? undefined : Math.min(Math.max(n, leaf.min ?? -Infinity), leaf.max ?? Infinity);
  const lo = within(minAt?.(read));
  const hi = within(maxAt?.(read));
  const min = lo === undefined ? leaf.min : leaf.min === undefined ? lo : Math.max(leaf.min, lo);
  const max = hi === undefined ? leaf.max : Math.max(min ?? -Infinity, leaf.max === undefined ? hi : Math.min(leaf.max, hi));
  return {
    ...rest,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  };
}

/** `n` held to `leaf`'s `min` and `max`, except an infinity an `endless` end stands for. */
export function prefClampNumber(leaf: PrefNumber, n: number): number {
  if (endlessAllows(leaf.endless, n)) return n;
  let v = n;
  if (leaf.min !== undefined && v < leaf.min) v = leaf.min;
  if (leaf.max !== undefined && v > leaf.max) v = leaf.max;
  return v;
}
