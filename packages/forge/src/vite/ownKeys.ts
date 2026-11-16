// Copies of @weasel-js/registry's getOwn and setOwn: vitest.config.ts loads these plugin files before any
// workspace package is built, and a workspace import here resolves to a dist that does not exist yet.

/** `record[key]` if `key` is `record`'s own, else undefined: a key like `constructor` finds no built-in. */
export function getOwn<V>(record: Readonly<Record<string, V>>, key: string): V | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Sets `record[key]` as an own property, so a key like `__proto__` is stored as data. */
export function setOwn(record: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
}
