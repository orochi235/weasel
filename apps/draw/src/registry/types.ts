/**
 * Registry-enum: a value type whose legal values are the ids in some live
 * runtime registry (tools, fonts, history entries, scene objects, …).
 *
 *   - Schema: an opaque payload (`source: string`, optional `filter`) the
 *     declaring code attaches to a field.
 *   - Resolution: a `RegistryEnumResolver` the host wires up, mapping each
 *     `source` id to the live option list (filtered as requested).
 */

/** One row in a registry-enum dropdown. `value` is what's stored; `label`
 *  is what's shown. */
export type RegistryEnumOption = { value: string; label: string };

/** Either a key/value criteria map or a predicate callback. The resolver
 *  for the source decides how to interpret either form; the map form
 *  typically delegates to `matchesRegistryFilter`. */
export type RegistryEnumFilter =
  | Record<string, unknown>
  | ((item: unknown) => boolean);

/** Source-side resolver: takes the field's optional `filter` and returns
 *  the live option list. Called every render the dropdown is visible, so
 *  resolvers should be cheap to invoke. */
export type RegistryEnumResolver =
  (filter?: RegistryEnumFilter) => readonly RegistryEnumOption[];

/** Map of source id → resolver. */
export type RegistryEnumSources = Record<string, RegistryEnumResolver>;

/** Apply a `RegistryEnumFilter` to a candidate. Map form does a shallow
 *  strict-equality match on every declared key (`item[k] === filter[k]`).
 *  No filter → keep everything. */
export function matchesRegistryFilter<T>(item: T, filter?: RegistryEnumFilter): boolean {
  if (filter == null) return true;
  if (typeof filter === 'function') return filter(item as unknown);
  const obj = item as unknown as Record<string, unknown>;
  for (const k of Object.keys(filter)) {
    if (obj?.[k] !== filter[k]) return false;
  }
  return true;
}
