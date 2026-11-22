import { InlineScan } from './inlineScan';

/** One piece of a line of inline markdown, as {@link parseInline} reads it. */
export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  /** A shortcut, as `keyLegendsFromChord` reads one. */
  | { type: 'keys'; chord: string }
  | { type: 'strong' | 'em' | 'del'; children: InlineToken[] }
  | { type: 'link'; href: string; children: InlineToken[] };

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
  const scan = new InlineScan(source);
  let at = 0;
  for (let p = 0; p < source.length; p++) {
    const m = scan.matchAt(p);
    if (m === null) continue;
    text(source.slice(at, p));
    at = m.end;
    p = m.end - 1;
    const { body } = m;
    switch (m.kind) {
      case 'code': out.push({ type: 'code', text: body }); break;
      case 'keys': out.push({ type: 'keys', chord: body }); break;
      case 'both': out.push({ type: 'em', children: [{ type: 'strong', children: parseInline(body) }] }); break;
      case 'strong': case 'em': case 'del': out.push({ type: m.kind, children: parseInline(body) }); break;
      case 'escaped': text(body); break;
      case 'link': {
        const children = parseInline(body);
        if (SAFE_HREF.test(m.href)) out.push({ type: 'link', href: m.href, children });
        else
          for (const child of children) {
            if (child.type === 'text') text(child.text);
            else out.push(child);
          }
      }
    }
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
