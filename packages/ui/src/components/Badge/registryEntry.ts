/** `registry`'s own entry for a key that may come from outside its type, so `'toString'` finds nothing. */
export function registryEntry<T>(registry: Readonly<Record<string, T>>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(registry, key) ? registry[key] : undefined;
}

/** `registry`'s own entry for `key`; throws a `RangeError` naming the key and `what` it should be when there is none. */
export function requireRegistryEntry<T>(registry: Readonly<Record<string, T>>, key: string, what: string): T {
  const entry = registryEntry(registry, key);
  if (entry === undefined) throw new RangeError(`No badge ${what} is named ${JSON.stringify(key)}`);
  return entry;
}
