/** `entries` on a null prototype, so a runtime name like `constructor` finds nothing instead of `Object.prototype`'s member. */
export function registryTable<T extends object>(entries: T): T {
  return Object.assign(Object.create(null) as T, entries);
}
