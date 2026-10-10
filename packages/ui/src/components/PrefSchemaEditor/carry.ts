import { isPlainObject } from '@weasel-js/core';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

type Bag = Record<string, unknown>;

/** The keys of `mine` carried from `from` to `to`, in the order the result holds them. */
function carriedKeys(mine: Bag, from: Bag, to: Bag): string[] {
  /** Not in the new source, and the reader's own: added, or changed before the source dropped it. */
  const kept = (k: string): boolean => !(k in to) && (!(k in from) || !same(mine[k], from[k]));
  const shared = (bag: Bag): string => Object.keys(bag).filter((k) => k in mine && k in from).join('\0');
  const keys = Object.keys(mine);
  if (shared(mine) !== shared(from)) {
    // The reader reordered: their order stands, and what the source added goes after it.
    return [...keys.filter((k) => k in to || kept(k)), ...Object.keys(to).filter((k) => !(k in from) && !(k in mine))];
  }
  const order = Object.keys(to).filter((k) => k in mine || !(k in from));
  keys.forEach((k, i) => {
    if (!kept(k)) return;
    const before = keys.slice(0, i).reverse().find((p) => order.includes(p));
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, k);
  });
  return order;
}

/**
 * `mine`, an edit of `from`, as the same edit of `to`: a three-way merge of JSON values. Where the reader changed
 * nothing the result is `to`'s; where they did, theirs, down to the attribute. A list is one value. A node the
 * reader moved is their own from then on, and does not follow what the source did to it.
 */
export function carry(mine: unknown, from: unknown, to: unknown): unknown {
  if (same(mine, from)) return to;
  if (!isPlainObject(mine) || !isPlainObject(from) || !isPlainObject(to)) return mine;
  const out: Bag = {};
  for (const k of carriedKeys(mine, from, to)) {
    out[k] = !(k in mine) ? to[k] : k in from && k in to ? carry(mine[k], from[k], to[k]) : mine[k];
  }
  return out;
}
