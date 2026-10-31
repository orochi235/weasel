/** A Mermaid block diagram's grammar, read to statements with each one's line. */
import { lineError } from '../../lineError';
import { SHAPES, type MermaidShape } from '../flowchart/lex';
import { statementsOf, type MermaidSource, type Statement } from '../common/lines';

/** A block: its id, its shape and text when it gives them, and the columns it spans. */
export interface BlockItem {
  kind: 'block';
  id: string;
  shape?: MermaidShape | 'arrow';
  text?: string;
  span?: number;
}

/** A link between blocks: its line, its heads, and its text. */
export interface BlockLink {
  stroke: 'normal' | 'thick' | 'dotted';
  start: boolean;
  end: boolean;
  text?: string;
}

export type BlockStmt =
  | { kind: 'items'; items: (BlockItem | { kind: 'space'; n: number })[]; line: number }
  | { kind: 'links'; ends: BlockItem[]; links: BlockLink[]; line: number }
  | { kind: 'group'; id?: string; span?: number; stmts: BlockStmt[]; line: number }
  | { kind: 'columns'; n?: number; line: number }
  | { kind: 'style'; text: string; line: number }
  | { kind: 'other'; keyword: string; line: number };

/** A whole block diagram. */
export interface BlockDiagram {
  source: MermaidSource;
  stmts: BlockStmt[];
}

const WORD = /[\p{L}\p{N}_](?:[\p{L}\p{N}_]|[-.](?=[\p{L}\p{N}_]))*/uy;
const LABELED = /(<)?(--|==|-\.)\s*"([^"]*)"\s*(-{2,}|={2,}|\.-+)(>)?/y;
const LINK = /(<)?(-{2,}|={2,}|-\.+-)(>)?(?:\|([^|]*)\|)?/y;
const SPAN = /:(\d+)/y;

const strokeOf = (body: string): BlockLink['stroke'] => (body.startsWith('=') ? 'thick' : body.includes('.') ? 'dotted' : 'normal');

/** One line's blocks, spaces, and links, read left to right. */
class LineReader {
  i = 0;

  constructor(readonly text: string, readonly line: number) {}

  sticky(re: RegExp): RegExpExecArray | null {
    re.lastIndex = this.i;
    const m = re.exec(this.text);
    if (m !== null) this.i += m[0].length;
    return m;
  }

  span(): number | undefined {
    const m = this.sticky(SPAN);
    return m === null ? undefined : Number(m[1]);
  }

  link(): BlockLink | null {
    const labeled = this.sticky(LABELED);
    if (labeled !== null) {
      return { stroke: strokeOf(labeled[2]!), start: labeled[1] !== undefined, end: labeled[5] !== undefined, text: labeled[3]! };
    }
    const m = this.sticky(LINK);
    if (m === null) return null;
    return { stroke: strokeOf(m[2]!), start: m[1] !== undefined, end: m[3] !== undefined, ...(m[4] !== undefined ? { text: m[4].trim() } : {}) };
  }

  /** The text between `open` and `close`, quoted or bare. */
  shapeText(open: string, close: string): string {
    const from = this.i + open.length;
    const quoted = /^\s*"([^"]*)"\s*/.exec(this.text.slice(from));
    const at = quoted !== null ? from + quoted[0].length : this.text.indexOf(close, from);
    if (at < 0 || !this.text.startsWith(close, at)) throw lineError('Mermaid', this.line, `a shape opened with "${open}" is never closed`);
    this.i = at + close.length;
    return quoted !== null ? quoted[1]! : this.text.slice(from, at).trim();
  }

  block(): BlockItem {
    const word = this.sticky(WORD);
    if (word === null) throw lineError('Mermaid', this.line, `cannot read "${this.text.slice(this.i)}" as a block`);
    const item: BlockItem = { kind: 'block', id: word[0] };
    if (this.text.startsWith('<[', this.i)) {
      item.shape = 'arrow';
      item.text = this.shapeText('<[', ']>');
      this.sticky(/\([\w, ]*\)/y);
    }
    for (const [open, closers] of item.shape === undefined ? SHAPES : []) {
      if (!this.text.startsWith(open, this.i)) continue;
      const found = closers.find(([close]) => this.text.indexOf(close, this.i + open.length) >= 0);
      if (found === undefined) throw lineError('Mermaid', this.line, `a shape opened with "${open}" is never closed`);
      item.shape = found[1];
      item.text = this.shapeText(open, found[0]);
      break;
    }
    const span = this.span();
    if (span !== undefined) item.span = span;
    return item;
  }

  /** The line as a run of blocks and spaces, or as blocks joined by links. */
  read(): BlockStmt {
    const items: (BlockItem | { kind: 'space'; n: number })[] = [];
    const links: BlockLink[] = [];
    for (;;) {
      this.sticky(/\s*/y);
      if (this.i >= this.text.length) break;
      const space = this.sticky(/space(?![\p{L}\p{N}_-])/uy);
      if (space !== null) {
        items.push({ kind: 'space', n: this.span() ?? 1 });
        continue;
      }
      const link = items.length > 0 ? this.link() : null;
      if (link !== null) links.push(link);
      else items.push(this.block());
    }
    if (links.length === 0) return { kind: 'items', items, line: this.line };
    const ends = items.filter((i): i is BlockItem => i.kind === 'block');
    if (ends.length !== links.length + 1 || ends.length !== items.length) {
      throw lineError('Mermaid', this.line, `cannot read "${this.text}" as blocks joined by links`);
    }
    return { kind: 'links', ends, links, line: this.line };
  }
}

const GROUP = /^block(?::([\p{L}\p{N}_][\p{L}\p{N}_-]*))?(?::(\d+))?$/u;

/** Statements up to the `end` closing a group opened on line `opened`, or to the end when `opened` is null. */
function block(lines: readonly Statement[], at: { i: number }, opened: number | null): BlockStmt[] {
  const out: BlockStmt[] = [];
  while (at.i < lines.length) {
    const { text, line } = lines[at.i++]!;
    if (text === 'end') {
      if (opened === null) throw lineError('Mermaid', line, '"end" closes no block');
      return out;
    }
    const group = GROUP.exec(text);
    const columns = /^columns\s+(\d+|auto)$/.exec(text);
    if (group !== null) {
      out.push({
        kind: 'group', line, stmts: block(lines, at, line),
        ...(group[1] !== undefined ? { id: group[1] } : {}), ...(group[2] !== undefined ? { span: Number(group[2]) } : {}),
      });
    } else if (columns !== null) out.push({ kind: 'columns', line, ...(columns[1] !== 'auto' ? { n: Number(columns[1]) } : {}) });
    else if (/^(classDef|class|style)\s/.test(text)) out.push({ kind: 'style', text, line });
    else if (/^(click|direction)\b/.test(text)) out.push({ kind: 'other', keyword: /^\w+/.exec(text)![0], line });
    else out.push(new LineReader(text, line).read());
  }
  if (opened !== null) throw lineError('Mermaid', opened, 'a block opened here is never closed');
  return out;
}

/** Parses a Mermaid block diagram. Throws, naming the line, on text that is not one. */
export function parseBlockDiagram(text: string): BlockDiagram {
  const source = statementsOf(text);
  if (!/^block(-beta)?$/.test(source.header.text)) {
    throw lineError('Mermaid', source.header.line, `expected a block-beta header, found "${source.header.text}"`);
  }
  return { source, stmts: block(source.body, { i: 0 }, null) };
}
