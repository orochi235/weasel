/** Mermaid text and ids, read and written alike by every diagram kind. */
import { markupLines } from '../../graphRead';
import { freshId } from '@weasel-js/registry';

/** Mermaid's text: markdown string quotes and bold dropped, entities and `<br>` read. */
export function textLines(text: string): string[] {
  const md = /^`([\s\S]*)`$/.exec(text);
  const plain = md !== null ? md[1]!.replace(/\*\*|__/g, '') : text;
  const lines = markupLines(plain, true);
  return lines.every((l) => l === '') ? [] : lines;
}

/** `text` broken at spaces into lines of at most `width` characters, a longer word on a line of its own: how a
 *  kind whose renderer wraps its text reads it into rows. */
export function wrapped(text: string, width = 32): string[] {
  const out: string[] = [];
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    const last = out.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= width) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out;
}

/** `text` without the double quotes around it, if it has them. */
export const unquote = (text: string): string => (/^".*"$/s.test(text) ? text.slice(1, -1) : text);

const RESERVED = new Set(['end', 'subgraph', 'graph', 'flowchart', 'style', 'classdef', 'class', 'click', 'linkstyle', 'direction', 'default', 'call', 'href']);
const ASCII = { id: /^[A-Za-z_]\w*$/, other: /\W+/g };
const UNICODE = { id: /^[\p{L}_][\p{L}\p{N}_]*$/u, other: /[^\p{L}\p{N}_]+/gu };

/** An id Mermaid reads for each of `ids`: itself where it can be, else a cleaned spelling no other id takes. `unicode`
 *  says the kind reads letters and digits of any script in an id, as a flowchart does; else only ASCII ones. */
export function mermaidIds(ids: readonly string[], { unicode = false } = {}): Map<string, string> {
  const chars = unicode ? UNICODE : ASCII;
  const valid = (id: string) => chars.id.test(id) && !RESERVED.has(id.toLowerCase());
  const out = new Map<string, string>();
  const taken = new Set(ids.filter(valid));
  for (const id of ids) {
    if (valid(id)) { out.set(id, id); continue; }
    let base = id.replace(chars.other, '_').replace(/^_+(?=[\p{L}\p{N}_])|(?<=[\p{L}\p{N}_])_+$/gu, '') || 'n';
    if (/^\d/.test(base)) base = `n${base}`;
    if (!valid(base)) base = `${base}_`;
    const pick = freshId(base, taken, { from: 2, sep: '_', bare: true });
    taken.add(pick);
    out.set(id, pick);
  }
  return out;
}

/** Text with the characters Mermaid reads as syntax spelled as entities, lines joined by `<br>`: an `&` only where
 *  it opens an entity, counting one the `&` after it opens once spelled, and a backtick only where the text opens and
 *  closes with one, as a markdown string does. `also` matches more characters for a kind to spell as entities. */
export function mermaidEscaped(lines: readonly string[], { also }: { also?: RegExp } = {}): string {
  const text = lines.map((l) => l
    .replace(/#/g, '#35;').replace(also ?? /(?!)/g, (c) => `#${c.codePointAt(0)};`)
    .replace(/&(?=&*(?:#x[\da-f]+|#\d+|[a-z]+);)/gi, '#38;')
    .replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;')).join('<br>');
  return /^`[\s\S]*`$/.test(text) ? `#96;${text.slice(1)}` : text;
}

/** One line of text as a Mermaid string: {@link mermaidEscaped}, in double quotes. */
export const mermaidQuoted = (text: string): string => `"${mermaidEscaped([text])}"`;

/** Text as Mermaid quotes it: {@link mermaidEscaped}, in double quotes, never empty. */
export function mermaidText(lines: readonly string[]): string {
  const text = mermaidEscaped(lines);
  return `"${text === '' ? ' ' : text}"`;
}
