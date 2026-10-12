/** Which external content a `drop` or `paste` spec's MIME globs let through. */

/** MIME-glob match: `'image/*'` prefix-matches the major type; anything
 *  else is an exact (case-insensitive) match; bare `'*'` or `'*\/*'` matches all. */
export function mimeMatchesGlob(mime: string, glob: string): boolean {
  const m = mime.toLowerCase();
  const g = glob.toLowerCase();
  if (g === '*' || g === '*/*') return true;
  if (g.endsWith('/*')) return m.startsWith(g.slice(0, -1));
  return m === g;
}

/** The MIME of an item whose type is not known yet: a file hovering in an OS
 *  drag, which some browsers do not name until it is dropped. */
export const UNKNOWN_MIME = '*/*';

/** True if ANY item's MIME matches ANY of the `types` globs.
 *  `types: []` (empty) ≡ omitted = match any. An item of
 *  {@link UNKNOWN_MIME} passes every glob. */
export function matchIngestTypes(
  items: readonly { mime: string }[],
  types: string[] | undefined,
): boolean {
  if (!types || types.length === 0) return true;
  return items.some((it) => it.mime === UNKNOWN_MIME || types.some((g) => mimeMatchesGlob(it.mime, g)));
}
