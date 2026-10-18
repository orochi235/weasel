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
 * `min` and `max`, whichever is tighter. The leaf itself when it has neither.
 */
export function prefNumberAt(leaf: PrefNumber, read: PrefBoundReader): PrefNumber {
  const { minAt, maxAt, ...rest } = leaf;
  if (minAt === undefined && maxAt === undefined) return leaf;
  const lo = minAt?.(read);
  const hi = maxAt?.(read);
  return {
    ...rest,
    ...(lo === undefined ? {} : { min: leaf.min === undefined ? lo : Math.max(leaf.min, lo) }),
    ...(hi === undefined ? {} : { max: leaf.max === undefined ? hi : Math.min(leaf.max, hi) }),
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
