/** A tag, with any `>` inside a double-quoted attribute value kept in it, or a run of character data. */
const TOKEN = /<(?:[^>"]|"[^"]*")*>|[^<]+/g;

const isTag = (t: string | undefined): t is string => t !== undefined && t.startsWith('<');
const isClose = (t: string) => t.startsWith('</');
const isSelfClosing = (t: string) => t.endsWith('/>');
const tagName = (t: string) => /^<\/?([^\s/>]+)/.exec(t)![1];

/** Index of the close tag matching the open tag at `open`. */
function matchingClose(tokens: readonly string[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isTag(t) || isSelfClosing(t)) continue;
    depth += isClose(t) ? -1 : 1;
    if (depth === 0) return i;
  }
  return tokens.length - 1;
}

/**
 * Indent the compact XML `serializeSvg` writes, one element per line. An
 * element whose content is, or begins with, character data is written whole,
 * and so is `<text>`: whitespace added inside either would be read as content.
 * Expects double-quoted attribute values and no whitespace between elements.
 */
export function prettyXml(xml: string): string {
  const tokens = xml.match(TOKEN) ?? [];
  const lines: string[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isTag(t) || isSelfClosing(t)) {
      lines.push('  '.repeat(depth) + t);
    } else if (isClose(t)) {
      depth--;
      lines.push('  '.repeat(depth) + t);
    } else if (tagName(t) === 'text' || !isTag(tokens[i + 1])) {
      const close = matchingClose(tokens, i);
      lines.push('  '.repeat(depth) + tokens.slice(i, close + 1).join(''));
      i = close;
    } else {
      lines.push('  '.repeat(depth) + t);
      depth++;
    }
  }
  return lines.join('\n');
}
