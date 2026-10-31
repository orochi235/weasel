/** A Mermaid flowchart's tokens: ids, node shapes, links, and the raw rest of keyword lines. */
import { lineError } from '../../lineError';
import { frontMatter } from '../common/header';

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

/** Each shape's openers, longest first, and the closers each may end with. */
export const SHAPES: readonly (readonly [string, readonly (readonly [string, MermaidShape])[]])[] = [
  ['(((', [[')))', 'double-circle']]], ['([', [['])', 'stadium']]], ['((', [['))', 'circle']]], ['(', [[')', 'rounded']]],
  ['[[', [[']]', 'subroutine']]], ['[(', [[')]', 'cylinder']]],
  ['[/', [['/]', 'lean-right'], ['\\]', 'trapezoid']]], ['[\\', [['\\]', 'lean-left'], ['/]', 'inv-trapezoid']]],
  ['[', [[']', 'rect']]], ['{{', [['}}', 'hexagon']]], ['{', [['}', 'diamond']]], ['>', [[']', 'asymmetric']]],
];

const WORD = /[\p{L}\p{N}_](?:[\p{L}\p{N}_]|[-.](?=[\p{L}\p{N}_]))*/uy;
const LINK = /([<ox])?(-{2,}|={2,}|-\.+-?|~{3,})(>|[ox](?![\p{L}\p{N}_]))?/uy;
const CLOSERS: Readonly<Record<string, RegExp>> = { '-': /\s*(--+[>ox]|---+)/y, '=': /\s*(==+[>ox]|===+)/y, '.': /\s*(\.-+[>ox]?)/y };

const fail = (line: number, message: string) => lineError('Mermaid', line, message);

const strokeOf = (body: string) => (body.startsWith('~') ? 'invisible' : body.startsWith('=') ? 'thick' : body.includes('.') ? 'dotted' : 'normal');


class MermaidLexer {
  readonly tokens: MermaidToken[] = [];
  readonly text: string;
  i = 0;
  line = 1;
  title: string | undefined;
  directives = 0;

  constructor(source: string) {
    this.text = source.replace(/\r\n?/g, '\n');
  }

  push(t: MermaidToken): void {
    const last = this.tokens[this.tokens.length - 1];
    if (t.kind === 'sep' && (last === undefined || last.kind === 'sep')) return;
    this.tokens.push(t);
  }

  atStart(): boolean {
    const last = this.tokens[this.tokens.length - 1];
    return last === undefined || last.kind === 'sep';
  }

  sticky(re: RegExp): RegExpExecArray | null {
    re.lastIndex = this.i;
    return re.exec(this.text);
  }

  lineEnd(): number {
    const end = this.text.indexOf('\n', this.i);
    return end < 0 ? this.text.length : end;
  }

  frontMatter(): void {
    const front = frontMatter(this.text);
    this.title = front.title;
    this.i = front.length;
    this.line += front.lines;
  }

  run(): MermaidLex {
    this.frontMatter();
    const { text } = this;
    while (this.i < text.length) {
      const c = text[this.i]!;
      if (c === '\n' || c === ';') {
        this.push({ kind: 'sep', line: this.line });
        if (c === '\n') this.line++;
        this.i++;
      } else if (c === ' ' || c === '\t') {
        this.i++;
      } else if (text.startsWith('%%{', this.i)) {
        this.directive();
      } else if (text.startsWith('%%', this.i)) {
        this.i = this.lineEnd();
      } else if (!this.mark(c) && !this.link()) {
        this.word(c);
      }
    }
    return { tokens: this.tokens, ...(this.title !== undefined ? { title: this.title } : {}), directives: this.directives };
  }

  directive(): void {
    const end = this.text.indexOf('}%%', this.i);
    const stop = end < 0 ? this.text.length : end + 3;
    for (let k = this.i; k < stop; k++) if (this.text[k] === '\n') this.line++;
    this.i = stop;
    this.directives++;
  }

  /** `&`, `:::class`, `@{ … }`, or `|text|`: whether one was read. */
  mark(c: string): boolean {
    const { text, line } = this;
    if (c === '&') {
      this.push({ kind: 'amp', value: '&', line });
      this.i++;
    } else if (text.startsWith(':::', this.i)) {
      this.i += 3;
      const m = this.sticky(WORD);
      if (m === null) throw fail(line, 'a class name must follow ":::"');
      this.i += m[0].length;
      this.push({ kind: 'class', value: m[0], line });
    } else if (text.startsWith('@{', this.i)) {
      const end = text.indexOf('}', this.i);
      if (end < 0) throw fail(line, 'node metadata is never closed');
      this.push({ kind: 'meta', value: text.slice(this.i + 2, end), line });
      this.i = end + 1;
    } else if (c === '|') {
      this.push({ kind: 'pipe', value: this.delimited('|', '|'), line });
    } else {
      return false;
    }
    return true;
  }

  word(c: string): void {
    const word = this.sticky(WORD);
    if (word === null) throw fail(this.line, `cannot read "${c}"`);
    const start = this.atStart();
    this.i += word[0].length;
    this.push({ kind: 'word', value: word[0], line: this.line });
    if (start && REST_KEYWORDS.has(word[0]) && /^(?:[ \t:]|$|\n)/.test(this.text.slice(this.i, this.i + 1))) {
      const semi = this.text.indexOf(';', this.i);
      const stop = Math.min(this.lineEnd(), semi < 0 ? this.text.length : semi);
      const rest = this.text.slice(this.i, stop).replace(/^[ \t]*:?/, '').trim();
      if (rest !== '') this.push({ kind: 'rest', value: rest, line: this.line });
      this.i = stop;
      return;
    }
    this.shape();
  }

  /** Text up to `close`, or a quoted string then `close`. */
  delimited(open: string, close: string): string {
    const { text, line } = this;
    this.i += open.length;
    while (text[this.i] === ' ') this.i++;
    let out: string;
    if (text[this.i] === '"') {
      const end = text.indexOf('"', this.i + 1);
      if (end < 0 || text.slice(this.i, end).includes('\n')) throw fail(line, 'a quoted string is never closed');
      out = text.slice(this.i + 1, end);
      this.i = end + 1;
      while (text[this.i] === ' ') this.i++;
      if (!text.startsWith(close, this.i)) throw fail(line, `expected "${close}" after a quoted string`);
    } else {
      const end = text.indexOf(close, this.i);
      if (end < 0 || text.slice(this.i, end).includes('\n')) throw fail(line, `text opened with "${open}" is never closed`);
      out = text.slice(this.i, end).trim();
      this.i = end;
    }
    this.i += close.length;
    return out;
  }

  shape(): void {
    for (const [open, closers] of SHAPES) {
      if (!this.text.startsWith(open, this.i)) continue;
      const from = this.i + open.length;
      const found = closers
        .map(([close, kind]) => ({ close, kind, at: this.closeAt(from, close) }))
        .filter((f) => f.at >= 0)
        .sort((a, b) => a.at - b.at)[0];
      if (found === undefined) throw fail(this.line, `a shape opened with "${open}" is never closed`);
      this.push({ kind: 'shape', shape: found.kind, text: this.delimited(open, found.close), line: this.line });
      return;
    }
  }

  /** Where `close` ends text starting at `from`, past a quoted string; -1 when not on this line. */
  closeAt(from: number, close: string): number {
    const { text } = this;
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

  link(): boolean {
    const m = this.sticky(LINK);
    if (m === null) return false;
    const [whole, lead, body, tail] = m as unknown as [string, LinkHead | undefined, string, LinkHead | undefined];
    if ((lead === 'o' || lead === 'x') && tail !== lead) return false;
    const stroke = strokeOf(body);
    const opens = tail === undefined && (body === '--' || body === '==' || /^-\.+$/.test(body))
      && /\s/.test(this.text[this.i + whole.length] ?? '');
    this.i += whole.length;
    if (!opens) {
      this.push({ kind: 'link', stroke, ...(lead ? { start: lead } : {}), ...(tail ? { end: tail } : {}), line: this.line });
      return true;
    }
    const { label, end } = this.linkText(body);
    this.push({ kind: 'link', stroke, ...(lead ? { start: lead } : {}), ...(end ? { end } : {}), text: label, line: this.line });
    return true;
  }

  /** The text of a link opened with `body` and a space, and the head its closing arrow ends in. */
  linkText(body: string): { label: string; end: LinkHead | undefined } {
    const { text } = this;
    const closer = CLOSERS[body.includes('.') ? '.' : body[0]!]!;
    let k = this.i;
    for (; k < text.length && text[k] !== '\n'; k++) {
      closer.lastIndex = k;
      if (closer.test(text) && /\s/.test(text[k] ?? '')) break;
    }
    if (k >= text.length || text[k] === '\n') throw fail(this.line, `a link's text after "${body}" is never closed`);
    const label = text.slice(this.i, k).trim();
    closer.lastIndex = k;
    const close = closer.exec(text)!;
    this.i = k + close[0].length;
    const head = close[1]!.slice(-1);
    return { label: /^".*"$/.test(label) ? label.slice(1, -1) : label, end: '>ox'.includes(head) ? head as LinkHead : undefined };
  }
}

/** Splits a Mermaid flowchart into tokens. Throws, naming the line, on text it cannot read. */
export function lexFlowchart(source: string): MermaidLex {
  return new MermaidLexer(source).run();
}
