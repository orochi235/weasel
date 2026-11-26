import { escapeAttr } from '@weasel-js/registry';

const TAG = /<(\/?)([\w:]+)((?:"[^"]*"|[^">])*)>/g;

/**
 * `xml` with `attrs` added to its first element and `children` written inside
 * it, before its closing tag. That element is the one a node's `id` goes on:
 * an outlined stroke or a stroke group writes more than one, and the rest are
 * left as they are.
 */
export function withDecoration(
  xml: string, attrs: Readonly<Record<string, string>> | undefined, children: string | undefined,
): string {
  const added = Object.entries(attrs ?? {}).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');
  if (added === '' && !children) return xml;
  const first = /^<([\w:]+)((?:"[^"]*"|[^">])*)>/.exec(xml);
  if (!first) return xml;
  const [open, name, inner] = first;
  const selfClosing = inner.endsWith('/');
  const head = `<${name}${selfClosing ? inner.slice(0, -1) : inner}${added}`;
  if (selfClosing) return children ? `${head}>${children}</${name}>${xml.slice(open.length)}` : `${head}/>${xml.slice(open.length)}`;
  const close = closeOf(xml, name, open.length);
  if (close < 0) return `${head}>${xml.slice(open.length)}`;
  return `${head}>${xml.slice(open.length, close)}${children ?? ''}${xml.slice(close)}`;
}

/** Where the closing tag of the element opened just before `from` begins, or -1. */
function closeOf(xml: string, name: string, from: number): number {
  let depth = 1;
  TAG.lastIndex = from;
  for (let m = TAG.exec(xml); m; m = TAG.exec(xml)) {
    if (m[2] !== name || m[3].endsWith('/')) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return -1;
}
