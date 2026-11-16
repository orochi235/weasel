import { getOwn, isPlainObject, setOwn } from '@weasel-js/registry';
import { sameStored } from '@weasel-js/storage';

type Bag = Record<string, unknown>;

const has = (bag: Bag, k: string): boolean => Object.hasOwn(bag, k);

/** The keys of `mine` carried from `from` to `to`, in the order the result holds them. */
function carriedKeys(mine: Bag, from: Bag, to: Bag): string[] {
  /** Not in the new source, and the reader's own: added, or changed before the source dropped it. Key order counts:
   *  a reader who only reordered keys has made an edit to carry. */
  const kept = (k: string): boolean => !has(to, k) && (!has(from, k) || !sameStored(getOwn(mine, k), getOwn(from, k)));
  const shared = (bag: Bag): string => Object.keys(bag).filter((k) => has(mine, k) && has(from, k)).join('\0');
  const keys = Object.keys(mine);
  if (shared(mine) !== shared(from)) {
    // The reader reordered: their order stands, and what the source added goes after it.
    return [...keys.filter((k) => has(to, k) || kept(k)), ...Object.keys(to).filter((k) => !has(from, k) && !has(mine, k))];
  }
  const order = Object.keys(to).filter((k) => has(mine, k) || !has(from, k));
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
  if (sameStored(mine, from)) return to;
  if (!isPlainObject(mine) || !isPlainObject(from) || !isPlainObject(to)) return mine;
  const out: Bag = {};
  for (const k of carriedKeys(mine, from, to)) {
    setOwn(out, k, !has(mine, k) ? getOwn(to, k) : has(from, k) && has(to, k) ? carry(getOwn(mine, k), getOwn(from, k), getOwn(to, k)) : getOwn(mine, k));
  }
  return out;
}
