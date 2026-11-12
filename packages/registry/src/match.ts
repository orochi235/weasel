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
 *  contains the query, ignoring case and how accented letters are
 *  encoded; text is tried before tags. An empty or
 *  whitespace query matches everything, by text. */
export function matchQuery(query: string, entry: Findable): QueryMatch | null {
  const q = foldText(query.trim());
  if (q === '') return BY_TEXT;
  if (entry.text.some((t) => t !== undefined && foldText(t).includes(q))) return BY_TEXT;
  const tag = entry.tags?.find((t) => foldText(t).includes(q));
  return tag === undefined ? null : { by: 'tag', tag };
}

/** `s` as text is searched: lowercased and composed, with final sigma folded to `σ`, the one letter `toLowerCase`
 *  spells by its place in a word, so a text holding the query exactly could otherwise miss it. Composing reads `é`
 *  and `e` + U+0301 alike. */
export function foldText(s: string): string {
  return s.toLowerCase().normalize('NFC').replaceAll('ς', 'σ');
}

/** Whether `tags` holds `tag` exactly: the test for gathering every entry
 *  carrying one, where `matchQuery` is the test for a person's search. */
export function hasTag(tags: readonly string[] | undefined, tag: string): boolean {
  return tags?.includes(tag) ?? false;
}
