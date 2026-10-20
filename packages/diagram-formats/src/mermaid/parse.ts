/** A Mermaid flowchart's grammar, read to a syntax tree with each statement's line. */
import { lineError } from '../lineError';
import { lexMermaid, type LinkHead, type MermaidShape, type MermaidToken } from './lex';

/** A node named in a chain, with whatever the mention says about it. */
export interface MermaidNodeRef {
  id: string;
  shape?: MermaidShape;
  text?: string;
  classes: string[];
  /** The `@{ … }` metadata's fields. */
  meta?: Record<string, string>;
  line: number;
}

export interface MermaidLink {
  stroke: 'normal' | 'thick' | 'dotted' | 'invisible';
  start?: LinkHead;
  end?: LinkHead;
  text?: string;
}

/** A style's `key:value` pairs, in order. */
export type StyleProps = [string, string][];

export type MermaidStmt =
  | { kind: 'chain'; groups: MermaidNodeRef[][]; links: MermaidLink[]; line: number }
  | { kind: 'subgraph'; id: string; title?: string; stmts: MermaidStmt[]; line: number }
  | { kind: 'direction'; value: string; line: number }
  | { kind: 'classDef'; names: string[]; props: StyleProps; line: number }
  | { kind: 'class'; ids: string[]; className: string; line: number }
  | { kind: 'style'; id: string; props: StyleProps; line: number }
  | { kind: 'linkStyle'; indexes: number[] | 'default'; props: StyleProps; line: number }
  | { kind: 'other'; keyword: string; line: number };

/** A whole flowchart. */
export interface MermaidFlowchart {
  title?: string;
  /** As written: `TB`, `TD`, `BT`, `LR`, or `RL`. */
  direction: string;
  directives: number;
  stmts: MermaidStmt[];
}

/** Mermaid diagram kinds other than flowcharts. */
export const OTHER_KINDS = /^(sequenceDiagram|classDiagram(-v2)?|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|C4\w*|mindmap|timeline|zenuml|sankey(-beta)?|xychart(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|radar(-beta)?|treemap(-beta)?)$/;

/** Splits on commas outside parentheses. */
function splitTop(text: string): string[] {
  const out = [''];
  let depth = 0;
  for (const c of text) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) out.push('');
    else out[out.length - 1] += c;
  }
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

const propsOf = (text: string): StyleProps => splitTop(text).map((p) => {
  const at = p.indexOf(':');
  return at < 0 ? [p, ''] : [p.slice(0, at).trim(), p.slice(at + 1).trim()];
});

function metaOf(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of propsOf(text)) out[k] = /^".*"$/.test(v) ? v.slice(1, -1) : v;
  return out;
}

const KEYWORDS = new Set(['subgraph', 'direction', 'classDef', 'class', 'style', 'linkStyle', 'click', 'accTitle', 'accDescr']);

/** The first statement's line, its first word, and its line number, read before lexing so another diagram kind's syntax is never lexed. */
export function headerWord(text: string): { word: string; text: string; line: number } | null {
  const lines = text.split(/\r\n?|\n/);
  let k = 0;
  if (/^---\s*$/.test(lines[0] ?? '')) {
    k = 1;
    while (k < lines.length && !/^---\s*$/.test(lines[k]!)) k++;
    k++;
  }
  for (; k < lines.length; k++) {
    const l = lines[k]!.trim();
    if (l === '' || l.startsWith('%%')) continue;
    return { word: /^[^\s;]+/.exec(l)![0], text: l, line: k + 1 };
  }
  return null;
}

const SUBGRAPH =/^(?:"([^"]*)"|([^\s[]+)\s*(?:\[\s*(?:"([^"]*)"|([^\]]*))\s*\])?|(.+))$/;

/** A keyword statement other than `subgraph`, from the rest of its line. */
function statementOf(keyword: string, rest: string, line: number): MermaidStmt {
  if (keyword === 'direction') return { kind: 'direction', value: rest.toUpperCase(), line };
  const [first = '', ...more] = rest.split(/\s+/);
  const remainder = rest.slice(first.length).trim();
  if (keyword === 'classDef') return { kind: 'classDef', names: first.split(','), props: propsOf(remainder), line };
  if (keyword === 'class') return { kind: 'class', ids: first.split(','), className: more.join(' '), line };
  if (keyword === 'style') return { kind: 'style', id: first, props: propsOf(remainder), line };
  if (keyword === 'linkStyle') {
    const indexes = first === 'default' ? 'default' : first.split(',').map(Number);
    if (indexes !== 'default' && indexes.some(Number.isNaN)) throw lineError('Mermaid', line, `"${first}" is not a list of link numbers`);
    return { kind: 'linkStyle', indexes, props: propsOf(remainder), line };
  }
  return { kind: 'other', keyword, line };
}

/** Parses a Mermaid flowchart. Throws, naming the line, on text that is not one. */
export function parseMermaid(text: string): MermaidFlowchart {
  const header = headerWord(text);
  if (header !== null && OTHER_KINDS.test(header.word)) {
    throw lineError('Mermaid', header.line, `${header.word} diagrams are not read; only flowcharts are`);
  }
  const { tokens, title, directives } = lexMermaid(text);
  let i = 0;
  const peek = () => tokens[i];
  const lastLine = text.split('\n').length;
  const where = () => peek()?.line ?? lastLine;
  const word = (t: MermaidToken | undefined, value?: string) => t?.kind === 'word' && (value === undefined || t.value === value);
  const describe = (t: MermaidToken | undefined) =>
    t === undefined ? 'the end of the file' : t.kind === 'sep' ? 'the end of the line' : `"${'value' in t ? t.value : t.kind}"`;
  const fail = (wanted: string) => lineError('Mermaid', where(), `expected ${wanted}, found ${describe(peek())}`);
  const restOf = () => (peek()?.kind === 'rest' ? (tokens[i++] as { value: string }).value : '');

  while (peek()?.kind === 'sep') i++;
  const head = peek();
  if (!word(head, 'flowchart') && !word(head, 'graph') && !word(head, 'flowchart-elk')) throw fail('a flowchart header');
  i++;
  const direction = restOf().toUpperCase() || 'TB';
  const stmts = block(null);
  return { ...(title !== undefined ? { title } : {}), direction, directives, stmts };

  function block(opened: number | null): MermaidStmt[] {
    const out: MermaidStmt[] = [];
    for (;;) {
      while (peek()?.kind === 'sep') i++;
      const t = peek();
      if (t === undefined) {
        if (opened !== null) throw lineError('Mermaid', opened, 'a subgraph opened here has no "end"');
        return out;
      }
      if (word(t, 'end')) {
        if (opened === null) throw lineError('Mermaid', t.line, '"end" closes no subgraph');
        i++;
        return out;
      }
      out.push(stmt());
      if (peek() !== undefined && peek()!.kind !== 'sep') throw fail('the end of the statement');
    }
  }

  function stmt(): MermaidStmt {
    const t = peek()!;
    const line = t.line;
    const next = tokens[i + 1];
    if (t.kind === 'word' && KEYWORDS.has(t.value) && (next === undefined || next.kind === 'rest' || next.kind === 'sep')) {
      i++;
      return keywordStmt(t.value, restOf(), line);
    }
    return chain();
  }

  function keywordStmt(keyword: string, rest: string, line: number): MermaidStmt {
    if (keyword === 'subgraph') {
      const m = SUBGRAPH.exec(rest);
      if (m === null) throw lineError('Mermaid', line, 'a subgraph needs a name');
      const id = m[1] ?? m[2] ?? m[5]!;
      const titleText = m[1] ?? m[3] ?? m[4]?.trim() ?? m[5];
      return { kind: 'subgraph', id, ...(titleText !== undefined ? { title: titleText } : {}), stmts: block(line), line };
    }
    return statementOf(keyword, rest, line);
  }

  function nodeRef(): MermaidNodeRef {
    const t = peek();
    if (t?.kind !== 'word') throw fail('a node');
    i++;
    const ref: MermaidNodeRef = { id: t.value, classes: [], line: t.line };
    const s = peek();
    if (s?.kind === 'shape') {
      i++;
      ref.shape = s.shape;
      ref.text = s.text;
    }
    for (let m = peek(); m?.kind === 'meta' || m?.kind === 'class'; m = peek()) {
      i++;
      if (m.kind === 'meta') ref.meta = metaOf(m.value);
      else ref.classes.push(m.value);
    }
    return ref;
  }

  function group(): MermaidNodeRef[] {
    const refs = [nodeRef()];
    while (peek()?.kind === 'amp') {
      i++;
      refs.push(nodeRef());
    }
    return refs;
  }

  function chain(): MermaidStmt {
    const line = where();
    const groups = [group()];
    const links: MermaidLink[] = [];
    for (let t = peek(); t?.kind === 'link'; t = peek()) {
      i++;
      const { kind: _k, line: _l, ...link } = t;
      const pipe = peek();
      if (pipe?.kind === 'pipe') {
        i++;
        link.text = pipe.value;
      }
      links.push(link);
      groups.push(group());
    }
    return { kind: 'chain', groups, links, line };
  }
}
