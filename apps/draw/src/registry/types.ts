/**
 * Registry-enum: a value type whose legal values are the ids in some live
 * runtime registry (tools, fonts, history entries, scene objects, …).
 * Currently consumed by the Preferences modal (`prefs.ts` /
 * `PreferencesModal.tsx`), but the convention is intentionally app-wide
 * so future property-panel rows or import flows can resolve an id
 * against a registry with the same vocabulary.
 *
 * Two halves:
 *   - Schema: an opaque payload (`source: string`, optional `filter`) the
 *     declaring code attaches to a field.
 *   - Resolution: a `RegistryEnumResolver` the host wires up, mapping each
 *     `source` id to the live option list (filtered as requested).
 *
 * `matchesRegistryFilter` is the shared matcher source resolvers can call
 * for the map form so semantics stay uniform across registries.
 */

/** One row in a registry-enum dropdown. `value` is what's stored; `label`
 *  is what's shown. Resolvers can synthesize labels however they like
 *  (registry's presentation block, formatted timestamp, etc.). */
export type RegistryEnumOption = { value: string; label: string };

/** Either a key/value criteria map or a predicate callback. The resolver
 *  for the source decides how to interpret either form:
 *   - Map form: shallow equality match on each declared key (the resolver
 *     typically delegates to `matchesRegistryFilter`).
 *   - Callback form: invoked once per candidate item. */
export type RegistryEnumFilter =
  | Record<string, unknown>
  | ((item: unknown) => boolean);

/** Source-side resolver: takes the field's optional `filter` and returns
 *  the live option list. Called every render the dropdown is visible, so
 *  resolvers should be cheap to invoke (typically a `.filter(...).map(...)`
 *  over an in-memory registry). */
export type RegistryEnumResolver =
  (filter?: RegistryEnumFilter) => readonly RegistryEnumOption[];

/** Map of source id → resolver. Hosts pass this to whichever component
 *  renders registry-enum fields (currently the Preferences modal; future
 *  callers can plug into the same convention). */
export type RegistryEnumSources = Record<string, RegistryEnumResolver>;

/** Apply a `RegistryEnumFilter` to a candidate. Map form does a shallow
 *  strict-equality match on every declared key (`item[k] === filter[k]`).
 *  Callback form invokes the predicate. No filter → keep everything.
 *  Source resolvers can use this so the matching semantics stay uniform
 *  across registries. */
export function matchesRegistryFilter<T>(item: T, filter?: RegistryEnumFilter): boolean {
  if (filter == null) return true;
  if (typeof filter === 'function') return filter(item as unknown);
  const obj = item as unknown as Record<string, unknown>;
  for (const k of Object.keys(filter)) {
    if (obj?.[k] !== filter[k]) return false;
  }
  return true;
}
