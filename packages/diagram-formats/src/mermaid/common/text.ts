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

/** `text` on one line, as a kind that holds no line break in some text writes it: each break and the space around it
 *  as one space. `warn` hears, naming `kind`, when there was one. */
export function oneLine(text: string, kind: string, warn: (message: string) => void): string {
  if (!/[\r\n]/.test(text)) return text;
  warn(`Mermaid ${kind} text holds one line; line breaks were written as spaces.`);
  return text.replace(/\s*[\r\n]+\s*/g, ' ');
}

/** Text a kind that splits its lines on `:` writes, as a gantt and a timeline do: on one line, with a `#` and a `:`
 *  spelled `#35;` and `#58;`, which {@link numberedText} reads back. */
export const spelledLine = (text: string, kind: string, warn: (message: string) => void): string =>
  oneLine(text, kind, warn).replace(/#/g, '#35;').replace(/:/g, '#58;');

/** Text {@link spelledLine} wrote, trimmed, its numbered references `#n;` read back as their characters. */
export const numberedText = (s: string): string =>
  s.trim().replace(/#(\d+);/g, (whole, n: string) => (Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : whole));

/** `text` as it opens a line, its first character spelled `#n;` where the line would otherwise read as a comment,
 *  accessibility text, or a statement opening with one of `words`. */
export function lineOpening(text: string, words: readonly string[]): string {
  const statement = words.some((w) => text === w || (text.startsWith(w) && /\s/.test(text[w.length]!)));
  return statement || /^%%|^acc(?:Title|Descr)\s*[:{]/.test(text) ? `#${text.codePointAt(0)};${text.slice(String.fromCodePoint(text.codePointAt(0)!).length)}` : text;
}

/** `text` without the double quotes around it, if it has them. */
export const unquote = (text: string): string => (/^".*"$/s.test(text) ? text.slice(1, -1) : text);

const RESERVED = new Set(['end', 'subgraph', 'graph', 'flowchart', 'style', 'classdef', 'class', 'click', 'linkstyle', 'direction', 'default', 'call', 'href']);
const ASCII = { id: /^[A-Za-z_]\w*$/, other: /\W+/g };
const UNICODE = { id: /^[\p{L}_][\p{L}\p{N}_]*$/u, other: /[^\p{L}\p{N}_]+/gu };

/** An id Mermaid reads for each of `ids`: itself where it can be, else a cleaned spelling no other id takes. `unicode`
 *  says the kind reads letters and digits of any script in an id, as a flowchart does; else only ASCII ones. `reserved`
 *  names more words a kind reads as keywords. */
export function mermaidIds(ids: readonly string[], { unicode = false, reserved = [] as readonly string[] } = {}): Map<string, string> {
  const chars = unicode ? UNICODE : ASCII;
  const more = new Set(reserved.map((w) => w.toLowerCase()));
  const valid = (id: string) => chars.id.test(id) && !RESERVED.has(id.toLowerCase()) && !more.has(id.toLowerCase());
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

/** `text` with its line ends spelled `#10;` and `#13;`, for a string a kind reads Mermaid's entities in, and an `&`
 *  spelled `#38;` where it would open an entity, one of those among them. */
export const spelledBreaks = (text: string): string => text
  .replace(/[\r\n]/g, (c) => `#${c.codePointAt(0)};`)
  .replace(/&(?=&*(?:#x[\da-f]+|#\d+|[a-z]+);)/gi, '#38;');

/** Text with the characters Mermaid reads as syntax spelled as entities, line ends within a line among them, lines
 *  joined by `<br>`: an `&` only where
 *  it opens an entity, counting one the `&` after it opens once spelled, and a backtick only where the text opens and
 *  closes with one, as a markdown string does. `also` matches more characters for a kind to spell as entities. */
export function mermaidEscaped(lines: readonly string[], { also }: { also?: RegExp } = {}): string {
  const text = lines.map((l) => l
    .replace(/#/g, '#35;').replace(also ?? /(?!)/g, (c) => `#${c.codePointAt(0)};`)
    .replace(/[\r\n]/g, (c) => `#${c.codePointAt(0)};`)
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
