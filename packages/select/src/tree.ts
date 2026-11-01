/** A tree as a selection reads it: each id's parent, or `null` (or `undefined`) at a root. */
export type ParentOf<K> = (id: K) => K | null | undefined;

/** The selected id that holds `id`: `id` itself when it is selected, else its nearest selected
 *  ancestor, else `null`. A node is selected whenever something holds it. */
export function holderOf<K>(selected: ReadonlySet<K>, id: K, parentOf: ParentOf<K>): K | null {
  for (let at: K | null | undefined = id; at != null; at = parentOf(at)) {
    if (selected.has(at)) return at;
  }
  return null;
}

/** `ids` less every id an ancestor in `ids` already holds, in their order: what a selection over
 *  a tree keeps explicitly. Returns `ids` itself when none is dropped. */
export function outermost<K>(ids: readonly K[], parentOf: ParentOf<K>): readonly K[] {
  if (ids.length < 2) return ids;
  const selected = new Set(ids);
  const held = (id: K): boolean => {
    const parent = parentOf(id);
    return parent != null && holderOf(selected, parent, parentOf) !== null;
  };
  return ids.some(held) ? ids.filter((id) => !held(id)) : ids;
}
