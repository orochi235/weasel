/** Pluralize a singular English noun for the selection summary. Naïve: it handles the
 *  -s, -es and -ies cases, and a kind label must be the singular (`'path'`), since one
 *  already plural gains another ending. */
function pluralize(noun: string, count: number): string {
  if (count === 1) return noun;
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/** Build the palette's selection summary from the ambient context. Returns
 *  `null` when no provider is in scope. */
export function describeSelection(
  ctx: { readonly selection: readonly string[]; readonly kinds?: readonly (string | undefined)[] } | null,
): string | null {
  if (ctx == null) return null;
  const n = ctx.selection.length;
  if (n === 0) return 'No selection';
  const kinds = ctx.kinds;
  // All entries reported the same non-undefined kind?
  if (kinds && kinds.length === n) {
    const first = kinds[0];
    if (typeof first === 'string' && kinds.every((k) => k === first)) {
      return `${n} ${pluralize(first, n)} selected`;
    }
  }
  return n === 1 ? '1 object selected' : `${n} objects selected`;
}
