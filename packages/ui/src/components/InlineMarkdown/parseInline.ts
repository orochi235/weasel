/** One piece of a line of inline markdown, as {@link parseInline} reads it. */
export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  /** A shortcut, as `keySpecsFromChord` reads one. */
  | { type: 'keys'; chord: string }
  | { type: 'strong' | 'em' | 'del'; children: InlineToken[] }
  | { type: 'link'; href: string; children: InlineToken[] };

// Alternatives in precedence order: a code span, a shortcut, strong, emphasis, strikethrough, a link, an escaped mark.
// A mark opens and closes against a non-space, so `a * b` and a glob's `*.ts` stay as written. Underscores
// are never emphasis: prose here names snake_case identifiers.
const INLINE =
  /`([^`]+)`|<kbd>([^<]+)<\/kbd>|\*\*(?=\S)([^]+?)(?<=\S)\*\*|\*(?=[^\s*])([^*]+?)(?<=\S)\*|~~(?=\S)([^]+?)(?<=\S)~~|\[([^\]]+)\]\(([^)\s]+)\)|\\([`*~[\]\\])/g;

const SAFE_HREF = /^(https?:|mailto:|[/#.])/i;

/**
 * Reads a line of inline markdown: code spans in backticks, a shortcut in `<kbd>Mod+Z</kbd>`, `**strong**`, `*emphasis*`,
 * `~~strikethrough~~`, and `[label](href)` links, with a backslash keeping a mark literal. Nothing
 * block-level. A link whose `href` is not http(s), mailto, or relative comes back as its label alone.
 */
export function parseInline(source: string): InlineToken[] {
  const out: InlineToken[] = [];
  const text = (s: string): void => {
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += s;
    else if (s) out.push({ type: 'text', text: s });
  };
  let at = 0;
  for (const m of source.matchAll(INLINE)) {
    text(source.slice(at, m.index));
    at = m.index + m[0].length;
    const [, code, chord, strong, em, del, label, href, escaped] = m;
    if (code !== undefined) out.push({ type: 'code', text: code });
    else if (chord !== undefined) out.push({ type: 'keys', chord });
    else if (strong !== undefined) out.push({ type: 'strong', children: parseInline(strong) });
    else if (em !== undefined) out.push({ type: 'em', children: parseInline(em) });
    else if (del !== undefined) out.push({ type: 'del', children: parseInline(del) });
    else if (label !== undefined && href !== undefined) {
      const children = parseInline(label);
      if (SAFE_HREF.test(href)) out.push({ type: 'link', href, children });
      else
        for (const child of children) {
          if (child.type === 'text') text(child.text);
          else out.push(child);
        }
    } else if (escaped !== undefined) text(escaped);
  }
  text(source.slice(at));
  return out;
}

/** The words of a line of inline markdown with its marks taken off, for a label or a description
 *  a screen reader speaks. */
export function inlineMarkdownText(source: string): string {
  const flat = (tokens: InlineToken[]): string =>
    tokens.map((t) => ('text' in t ? t.text : 'chord' in t ? t.chord : flat(t.children))).join('');
  return flat(parseInline(source));
}
