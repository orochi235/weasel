/** `registry`'s own entry for a key that may come from outside its type, so `'toString'` finds nothing. */
export function registryEntry<T>(registry: Readonly<Record<string, T>>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(registry, key) ? registry[key] : undefined;
}
