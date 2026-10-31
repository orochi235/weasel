/** List edits every chart kind's structural edits are built from, as plain data in and out. */

/** `list` with `item` inserted before index `at`; `at` equal to the length appends. Throws on any other index. */
export function insertAt<T>(list: readonly T[], at: number, item: T, who: string): T[] {
  if (!Number.isInteger(at) || at < 0 || at > list.length) throw new Error(`${who}: cannot insert at ${at} in a list of ${list.length}`);
  return [...list.slice(0, at), item, ...list.slice(at)];
}

/** `list` without item `at`. Throws on an index it does not hold. */
export function removeAt<T>(list: readonly T[], at: number, who: string): T[] {
  if (!Number.isInteger(at) || at < 0 || at >= list.length) throw new Error(`${who}: no item ${at} in a list of ${list.length}`);
  return list.filter((_, i) => i !== at);
}

/** `list` with item `from` moved to index `to`, counted once it is taken out. Throws on an index it does not hold. */
export function moveAt<T>(list: readonly T[], from: number, to: number, who: string): T[] {
  const out = removeAt(list, from, who);
  if (!Number.isInteger(to) || to < 0 || to > out.length) throw new Error(`${who}: cannot move to ${to} in a list of ${list.length}`);
  out.splice(to, 0, list[from]!);
  return out;
}

/** `list` with item `at` replaced by what `change` makes of it. Throws on an index it does not hold. */
export function updateAt<T>(list: readonly T[], at: number, change: (item: T) => T, who: string): T[] {
  if (!Number.isInteger(at) || at < 0 || at >= list.length) throw new Error(`${who}: no item ${at} in a list of ${list.length}`);
  return list.map((x, i) => (i === at ? change(x) : x));
}

/** `base`, `sep`, and the first number from `from` up that makes a name `taken` does not hold: `Slice 3`. */
export function freshName(base: string, taken: Iterable<string>, from = 1, sep = ' '): string {
  const used = new Set(taken);
  let n = from;
  while (used.has(`${base}${sep}${n}`)) n++;
  return `${base}${sep}${n}`;
}

/** `obj` with `key` set to `value`, or without it when `value` is `undefined`. */
export function withOptional<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const { [key]: _, ...rest } = obj;
  return (value === undefined ? rest : { ...rest, [key]: value }) as T;
}
