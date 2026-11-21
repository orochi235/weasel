/** How many locales a per-locale cache keeps: more than a page shows at once, few enough that
 *  tags built from user input cannot grow it for the life of the page. */
export const LOCALE_CACHE_LIMIT = 64;

/** `cache`'s entry for `key`, made by `make` when absent; past `limit` the least recently used goes. */
export function remembered<V>(cache: Map<string, V>, key: string, make: () => V, limit = LOCALE_CACHE_LIMIT): V {
  if (cache.has(key)) {
    const known = cache.get(key) as V;
    cache.delete(key);
    cache.set(key, known);
    return known;
  }
  const made = make();
  cache.set(key, made);
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
  return made;
}
