// A leaf's `per`: the selectors its value is always kept separately for,
// read into what the locus functions take. Every name with `tbd` in it is a
// placeholder until the feature is named.

import { TBD_REST_KEY, type PrefLocus, type TbdClosed, type TbdClosedLists } from './locus';
import type { PrefLeaf } from './schema';

/**
 * One selector a leaf's value is kept separately for. `selector` is the full
 * path of an `enum` leaf, or a path naming no leaf, whose options the app
 * names as it reads and writes (`at`).
 *
 * With `overrides` the selector is closed: only the options it names keep a
 * value of their own, and every other option shares one. Given as option →
 * value, an option reads that value until one is written for it. Without
 * `overrides` it is open: an option keeps a value of its own once one is
 * written for it, and reads the shared one until then.
 */
export interface TbdPer {
  selector: string;
  overrides?: readonly string[] | Readonly<Record<string, unknown>>;
}

/** The selectors a pref's value may be held split by: its `per`'s, in order. */
export function tbdPerAxes(leaf: PrefLeaf): readonly string[] | undefined {
  return leaf.per?.length ? leaf.per.map((per) => per.selector) : undefined;
}

const closedOf = (overrides: NonNullable<TbdPer['overrides']>): TbdClosed =>
  (Array.isArray(overrides)
    ? { options: overrides as readonly string[], proposed: {} }
    : { options: Object.keys(overrides), proposed: overrides as Readonly<Record<string, unknown>> });

const withShared = (by: string, shared: PrefLocus): PrefLocus => ({ $by: by, $in: {}, [TBD_REST_KEY]: shared });

const closedCache = new WeakMap<PrefLeaf, TbdClosedLists | undefined>();

/** The leaf's closed selectors and their lists, by the selector's path. */
export function tbdPerClosed(leaf: PrefLeaf): TbdClosedLists | undefined {
  if (!leaf.per?.length) return undefined;
  if (!closedCache.has(leaf)) {
    const closed = leaf.per.flatMap((per) => (per.overrides === undefined ? [] : [[per.selector, closedOf(per.overrides)] as const]));
    closedCache.set(leaf, closed.length ? Object.fromEntries(closed) : undefined);
  }
  return closedCache.get(leaf);
}

/**
 * What the leaf holds while nothing is stored for it: its `defaultLocus`, or
 * else one locus per `per` entry, outermost first, each holding no member
 * of its own and the next one in as its shared member, the last with none so
 * it reads `default`.
 */
export function tbdPerDefault(leaf: PrefLeaf): PrefLocus | undefined {
  if (leaf.defaultLocus !== undefined || !leaf.per?.length) return leaf.defaultLocus;
  let inner: PrefLocus | undefined;
  for (const per of [...leaf.per].reverse()) {
    inner = inner === undefined ? { $by: per.selector, $in: {} } : withShared(per.selector, inner);
  }
  return inner;
}
