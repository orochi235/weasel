/** `record[key]` when `record` holds `key` itself, else `undefined`: a key read from outside may name an
 *  `Object.prototype` member (`constructor`, `toString`), which a bare read finds on the prototype. */
export function getOwn<V>(record: Readonly<Record<string, V>>, key: string): V | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** `key in table`, counting only `table`'s own keys, and narrowing `key` to them. */
export function hasOwnKey<T extends object>(table: T, key: PropertyKey): key is keyof T {
  return Object.hasOwn(table, key);
}
