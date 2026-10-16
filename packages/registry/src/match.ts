/**
 * The one text search every registry's finder shares, so a query reaches a
 * command palette's actions and a settings form's prefs the same way.
 */

/** What a search can find an entry by: the words it reads as, and its tags. */
export interface Findable {
  /** Label, description, path: whatever the entry is called. Absent fields are skipped. */
  readonly text: readonly (string | undefined)[];
  readonly tags?: readonly string[];
}

/** Why an entry answered a query: its text, or one of its tags. */
export type QueryMatch = { readonly by: 'text' } | { readonly by: 'tag'; readonly tag: string };

const BY_TEXT: QueryMatch = { by: 'text' };

/** Whether `entry` answers `query`, and by what. Each field matches when it
 *  contains the query, ignoring case; text is tried before tags. An empty or
 *  whitespace query matches everything, by text. */
export function matchQuery(query: string, entry: Findable): QueryMatch | null {
  const q = query.trim().toLowerCase();
  if (q === '') return BY_TEXT;
  if (entry.text.some((t) => t !== undefined && t.toLowerCase().includes(q))) return BY_TEXT;
  const tag = entry.tags?.find((t) => t.toLowerCase().includes(q));
  return tag === undefined ? null : { by: 'tag', tag };
}

/** Whether `tags` holds `tag` exactly: the test for gathering every entry
 *  carrying one, where `matchQuery` is the test for a person's search. */
export function hasTag(tags: readonly string[] | undefined, tag: string): boolean {
  return tags?.includes(tag) ?? false;
}
