/** A Mermaid flowchart's tokens: ids, node shapes, links, and the raw rest of keyword lines. */
import { lineError } from '../lineError';

/** A node shape's syntax, by the brackets around its text. */
export type MermaidShape =
  | 'rect' | 'rounded' | 'stadium' | 'subroutine' | 'cylinder' | 'circle' | 'double-circle' | 'asymmetric'
  | 'diamond' | 'hexagon' | 'lean-right' | 'lean-left' | 'trapezoid' | 'inv-trapezoid';

/** A link end: an arrow, a circle, or a cross. */
export type LinkHead = '<' | '>' | 'o' | 'x';

export type MermaidToken = { line: number } & (
  | { kind: 'word' | 'rest' | 'pipe' | 'class' | 'meta' | 'amp'; value: string }
  | { kind: 'shape'; shape: MermaidShape; text: string }
  | { kind: 'link'; stroke: 'normal' | 'thick' | 'dotted' | 'invisible'; start?: LinkHead; end?: LinkHead; text?: string }
  | { kind: 'sep' }
);

/** A flowchart's tokens, and what came before them. */
export interface MermaidLex {
  tokens: MermaidToken[];
  /** The front matter's `title`. */
  title?: string;
  /** How many `%%{…}%%` directives there were. */
  directives: number;
}

/** Keywords whose line runs to its end as one `rest` token. */
const REST_KEYWORDS = new Set([
  'flowchart', 'graph', 'flowchart-elk', 'subgraph', 'style', 'classDef', 'class', 'linkStyle', 'click', 'direction',
  'accTitle', 'accDescr',
]);

/** Openers, longest first, and the closers each may end with. */
const SHAPES: readonly (readonly [string, readonly (readonly [string, MermaidShape])[]])[] = [
  ['(((', [[')))', 'double-circle']]], ['([', [['])', 'stadium']]], ['((', [['))', 'circle']]], ['(', [[')', 'rounded']]],
  ['[[', [[']]', 'subroutine']]], ['[(', [[')]', 'cylinder']]],
  ['[/', [['/]', 'lean-right'], ['\\]', 'trapezoid']]], ['[\\', [['\\]', 'lean-left'], ['/]', 'inv-trapezoid']]],
  ['[', [[']', 'rect']]], ['{{', [['}}', 'hexagon']]], ['{', [['}', 'diamond']]], ['>', [[']', 'asymmetric']]],
];

const WORD = /[\p{L}\p{N}_](?:[\p{L}\p{N}_]|[-.](?=[\p{L}\p{N}_]))*/uy;
const LINK = /([<ox])?(-{2,}|={2,}|-\.+-?|~{3,})(>|[ox](?![\p{L}\p{N}_]))?/uy;
const CLOSERS: Readonly<Record<string, RegExp>> = { '-': /\s*(--+[>ox]|---+)/y, '=': /\s*(==+[>ox]|===+)/y, '.': /\s*(\.-+[>ox]?)/y };

const fail = (line: number, message: string) => lineError('Mermaid', line, message);

function jsonString(quoted: string): string {
  try {
    return JSON.parse(quoted) as string;
  } catch {
    return quoted.slice(1, -1);
  }
}
const strokeOf = (body: string) => (body.startsWith('~') ? 'invisible' : body.startsWith('=') ? 'thick' : body.includes('.') ? 'dotted' : 'normal');

/** Splits a Mermaid flowchart into tokens. Throws, naming the line, on text it cannot read. */
export function lexMermaid(source: string): MermaidLex {
  const text = source.replace(/\r\n?/g, '\n');
  const tokens: MermaidToken[] = [];
  let i = 0;
  let line = 1;
  let title: string | undefined;
  let directives = 0;
  const front = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (front !== null) {
    const t = /^title:[ \t]*(.*)$/m.exec(front[1]!)?.[1]?.trim();
    if (t !== undefined) title = /^".*"$/.test(t) ? jsonString(t) : /^'.*'$/.test(t) ? t.slice(1, -1).replace(/''/g, "'") : t;
    i = front[0].length;
    line += front[0].split('\n').length - (front[0].endsWith('\n') ? 1 : 0);
  }
  const push = (t: MermaidToken) => {
    if (t.kind === 'sep' && (tokens.length === 0 || tokens[tokens.length - 1]!.kind === 'sep')) return;
    tokens.push(t);
  };
  const atStart = () => tokens.length === 0 || tokens[tokens.length - 1]!.kind === 'sep';
  const sticky = (re: RegExp) => {
    re.lastIndex = i;
    return re.exec(text);
  };

  while (i < text.length) {
    const c = text[i]!;
    if (c === '\n' || c === ';') { push({ kind: 'sep', line }); if (c === '\n') line++; i++; continue; }
    if (c === ' ' || c === '\t') { i++; continue; }
    if (text.startsWith('%%{', i)) {
      const end = text.indexOf('}%%', i);
      const stop = end < 0 ? text.length : end + 3;
      for (let k = i; k < stop; k++) if (text[k] === '\n') line++;
      i = stop;
      directives++;
      continue;
    }
    if (text.startsWith('%%', i)) { i = lineEnd(); continue; }
    if (c === '&') { push({ kind: 'amp', value: '&', line }); i++; continue; }
    if (text.startsWith(':::', i)) {
      i += 3;
      const m = sticky(WORD);
      if (m === null) throw fail(line, 'a class name must follow ":::"');
      i += m[0].length;
      push({ kind: 'class', value: m[0], line });
      continue;
    }
    if (text.startsWith('@{', i)) {
      const end = text.indexOf('}', i);
      if (end < 0) throw fail(line, 'node metadata is never closed');
      push({ kind: 'meta', value: text.slice(i + 2, end), line });
      i = end + 1;
      continue;
    }
    if (c === '|') { push({ kind: 'pipe', value: delimited('|', '|'), line }); continue; }
    if (link()) continue;
    const word = sticky(WORD);
    if (word === null) throw fail(line, `cannot read "${c}"`);
    const start = atStart();
    i += word[0].length;
    push({ kind: 'word', value: word[0], line });
    if (start && REST_KEYWORDS.has(word[0]) && /^(?:[ \t:]|$|\n)/.test(text.slice(i, i + 1))) {
      const stop = Math.min(lineEnd(), text.indexOf(';', i) < 0 ? text.length : text.indexOf(';', i));
      const rest = text.slice(i, stop).replace(/^[ \t]*:?/, '').trim();
      if (rest !== '') push({ kind: 'rest', value: rest, line });
      i = stop;
      continue;
    }
    shape();
  }
  return { tokens, ...(title !== undefined ? { title } : {}), directives };

  function lineEnd(): number {
    const end = text.indexOf('\n', i);
    return end < 0 ? text.length : end;
  }

  /** Text up to `close`, or a quoted string then `close`. */
  function delimited(open: string, close: string): string {
    i += open.length;
    while (text[i] === ' ') i++;
    let out: string;
    if (text[i] === '"') {
      const end = text.indexOf('"', i + 1);
      if (end < 0 || text.slice(i, end).includes('\n')) throw fail(line, 'a quoted string is never closed');
      out = text.slice(i + 1, end);
      i = end + 1;
      while (text[i] === ' ') i++;
      if (!text.startsWith(close, i)) throw fail(line, `expected "${close}" after a quoted string`);
    } else {
      const end = text.indexOf(close, i);
      if (end < 0 || text.slice(i, end).includes('\n')) throw fail(line, `text opened with "${open}" is never closed`);
      out = text.slice(i, end).trim();
      i = end;
    }
    i += close.length;
    return out;
  }

  function shape(): void {
    for (const [open, closers] of SHAPES) {
      if (!text.startsWith(open, i)) continue;
      const from = i + open.length;
      const found = closers
        .map(([close, kind]) => ({ close, kind, at: closeAt(from, close) }))
        .filter((f) => f.at >= 0)
        .sort((a, b) => a.at - b.at)[0];
      if (found === undefined) throw fail(line, `a shape opened with "${open}" is never closed`);
      push({ kind: 'shape', shape: found.kind, text: delimited(open, found.close), line });
      return;
    }
  }

  /** Where `close` ends text starting at `from`, past a quoted string; -1 when not on this line. */
  function closeAt(from: number, close: string): number {
    let k = from;
    while (text[k] === ' ') k++;
    if (text[k] === '"') {
      const end = text.indexOf('"', k + 1);
      if (end >= 0) k = end + 1;
    }
    const at = text.indexOf(close, k);
    const eol = text.indexOf('\n', from);
    return at < 0 || (eol >= 0 && at > eol) ? -1 : at;
  }

  function link(): boolean {
    const m = sticky(LINK);
    if (m === null) return false;
    const [whole, lead, body, tail] = m as unknown as [string, LinkHead | undefined, string, LinkHead | undefined];
    if ((lead === 'o' || lead === 'x') && tail !== lead) return false;
    const stroke = strokeOf(body);
    const opens = tail === undefined && (body === '--' || body === '==' || /^-\.+$/.test(body)) && /\s/.test(text[i + whole.length] ?? '');
    i += whole.length;
    if (!opens) {
      push({ kind: 'link', stroke, ...(lead ? { start: lead } : {}), ...(tail ? { end: tail } : {}), line });
      return true;
    }
    const closer = CLOSERS[body.includes('.') ? '.' : body[0]!]!;
    let k = i;
    for (; k < text.length && text[k] !== '\n'; k++) {
      closer.lastIndex = k;
      if (closer.test(text) && /\s/.test(text[k] ?? '')) break;
    }
    if (k >= text.length || text[k] === '\n') throw fail(line, `a link's text after "${body}" is never closed`);
    const label = text.slice(i, k).trim();
    closer.lastIndex = k;
    const close = closer.exec(text)!;
    i = k + close[0].length;
    const head = close[1]!.slice(-1);
    const end = '>ox'.includes(head) ? head as LinkHead : undefined;
    push({
      kind: 'link', stroke, ...(lead ? { start: lead } : {}), ...(end ? { end } : {}),
      text: /^".*"$/.test(label) ? label.slice(1, -1) : label, line,
    });
    return true;
  }
}
