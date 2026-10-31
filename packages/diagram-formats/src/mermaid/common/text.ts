/** Mermaid text and ids, read and written alike by every diagram kind. */
import { markupLines } from '../../graphRead';

/** Mermaid's text: markdown string quotes and bold dropped, entities and `<br>` read. */
export function textLines(text: string): string[] {
  const md = /^`([\s\S]*)`$/.exec(text);
  const plain = md !== null ? md[1]!.replace(/\*\*|__/g, '') : text;
  const lines = markupLines(plain, true);
  return lines.every((l) => l === '') ? [] : lines;
}

/** `text` without the double quotes around it, if it has them. */
export const unquote = (text: string): string => (/^".*"$/s.test(text) ? text.slice(1, -1) : text);

const RESERVED = new Set(['end', 'subgraph', 'graph', 'flowchart', 'style', 'classdef', 'class', 'click', 'linkstyle', 'direction', 'default', 'call', 'href']);
const valid = (id: string) => /^[A-Za-z_]\w*$/.test(id) && !RESERVED.has(id.toLowerCase());

/** An id Mermaid reads for each of `ids`: itself where it can be, else a cleaned spelling no other id takes. */
export function mermaidIds(ids: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set(ids.filter(valid));
  for (const id of ids) {
    if (valid(id)) { out.set(id, id); continue; }
    let base = id.replace(/\W+/g, '_').replace(/^_+(?=\w)|(?<=\w)_+$/g, '') || 'n';
    if (/^\d/.test(base)) base = `n${base}`;
    if (!valid(base)) base = `${base}_`;
    let pick = base;
    for (let n = 2; taken.has(pick); n++) pick = `${base}_${n}`;
    taken.add(pick);
    out.set(id, pick);
  }
  return out;
}

/** Text with the characters Mermaid reads as syntax spelled as entities, lines joined by `<br>`. */
export function mermaidEscaped(lines: readonly string[]): string {
  return lines.map((l) => l.replace(/#/g, '#35;').replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;')).join('<br>');
}

/** Text as Mermaid quotes it: {@link mermaidEscaped}, in double quotes. */
export function mermaidText(lines: readonly string[]): string {
  const text = mermaidEscaped(lines);
  return `"${text === '' ? ' ' : text}"`;
}
