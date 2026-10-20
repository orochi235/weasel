/** Graphviz DOT's grammar, read to a syntax tree with each statement's line. */
import { lineError } from '../lineError';
import { lexDot, type DotToken } from './lex';

/** An attribute's value as written: quoted, or an HTML string, or neither. */
export interface DotValue {
  value: string;
  quoted?: boolean;
  html?: boolean;
}

export interface DotAttr {
  key: string;
  value: DotValue;
}

/** A node named in a statement, with the port and compass point it was named with. */
export interface DotNodeRef {
  id: string;
  port?: string;
  compass?: string;
  line: number;
}

export interface DotSubgraph {
  kind: 'subgraph';
  id?: string;
  stmts: DotStmt[];
  line: number;
}

export type DotStmt =
  | { kind: 'node'; node: DotNodeRef; attrs: DotAttr[]; line: number }
  | { kind: 'edge'; ends: (DotNodeRef | DotSubgraph)[]; attrs: DotAttr[]; line: number }
  | { kind: 'attr'; target: 'graph' | 'node' | 'edge'; attrs: DotAttr[]; line: number }
  | { kind: 'set'; key: string; value: DotValue; line: number }
  | DotSubgraph;

/** A whole DOT file. */
export interface DotGraph {
  strict: boolean;
  directed: boolean;
  id?: string;
  stmts: DotStmt[];
}

/** The compass points a node end may name. */
export const COMPASS_POINTS: ReadonlySet<string> = new Set(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'c', '_']);

const keyword = (t: DotToken | undefined, word: string) =>
  t !== undefined && t.kind === 'id' && !t.quoted && !t.html && t.value.toLowerCase() === word;

const valueOf = (t: DotToken): DotValue => ({ value: t.value, ...(t.quoted ? { quoted: true } : {}), ...(t.html ? { html: true } : {}) });

/** Parses DOT source. Throws, naming the line, on text that is not a DOT graph. */
export function parseDot(text: string): DotGraph {
  const tokens = lexDot(text);
  let i = 0;
  const lastLine = text.split('\n').length;
  const peek = (k = 0) => tokens[i + k];
  const where = () => peek()?.line ?? lastLine;
  const describe = (t: DotToken | undefined) => (t === undefined ? 'the end of the file' : `"${t.value}"`);
  const fail = (wanted: string) => lineError('DOT', where(), `expected ${wanted}, found ${describe(peek())}`);
  const is = (value: string) => peek()?.kind !== 'id' && peek()?.value === value;
  const take = (value: string) => {
    if (!is(value)) throw fail(`"${value}"`);
    return tokens[i++]!;
  };
  const id = (wanted = 'a name'): DotToken => {
    if (peek()?.kind !== 'id') throw fail(wanted);
    return tokens[i++]!;
  };

  const strict = keyword(peek(), 'strict');
  if (strict) i++;
  const kind = peek();
  if (!keyword(kind, 'graph') && !keyword(kind, 'digraph')) throw fail('"graph" or "digraph"');
  i++;
  const directed = kind!.value.toLowerCase() === 'digraph';
  const graphId = peek()?.kind === 'id' ? tokens[i++]!.value : undefined;
  take('{');
  const stmts = stmtList();
  take('}');
  if (peek() !== undefined) throw fail('the end of the file');
  return { strict, directed, ...(graphId !== undefined ? { id: graphId } : {}), stmts };

  function stmtList(): DotStmt[] {
    const out: DotStmt[] = [];
    while (peek() !== undefined && !is('}')) {
      out.push(stmt());
      if (is(';')) i++;
    }
    return out;
  }

  function attrList(): DotAttr[] {
    const attrs: DotAttr[] = [];
    while (is('[')) {
      i++;
      while (!is(']')) {
        const key = id('an attribute name').value;
        take('=');
        attrs.push({ key, value: valueOf(id('an attribute value')) });
        if (is(',') || is(';')) i++;
      }
      i++;
    }
    return attrs;
  }

  function subgraph(): DotSubgraph {
    const line = where();
    let name: string | undefined;
    if (keyword(peek(), 'subgraph')) {
      i++;
      if (peek()?.kind === 'id') name = tokens[i++]!.value;
    }
    take('{');
    const body = stmtList();
    take('}');
    return { kind: 'subgraph', ...(name !== undefined ? { id: name } : {}), stmts: body, line };
  }

  function nodeRef(): DotNodeRef {
    const t = id();
    const ref: DotNodeRef = { id: t.value, line: t.line };
    if (!is(':')) return ref;
    i++;
    const first = id('a port').value;
    if (is(':')) {
      i++;
      return { ...ref, port: first, compass: id('a compass point').value };
    }
    return COMPASS_POINTS.has(first) ? { ...ref, compass: first } : { ...ref, port: first };
  }

  function stmt(): DotStmt {
    const line = where();
    const t = peek()!;
    if (keyword(t, 'graph') || keyword(t, 'node') || keyword(t, 'edge')) {
      i++;
      return { kind: 'attr', target: t.value.toLowerCase() as 'graph' | 'node' | 'edge', attrs: attrList(), line };
    }
    if (t.kind === 'id' && peek(1)?.kind === 'punct' && peek(1)!.value === '=' && !keyword(t, 'subgraph')) {
      i += 2;
      return { kind: 'set', key: t.value, value: valueOf(id('a value')), line };
    }
    const first = keyword(t, 'subgraph') || is('{') ? subgraph() : nodeRef();
    if (peek()?.kind !== 'edgeop') {
      if (first.kind === 'subgraph') return first;
      return { kind: 'node', node: first, attrs: attrList(), line };
    }
    const ends: (DotNodeRef | DotSubgraph)[] = [first];
    while (peek()?.kind === 'edgeop') {
      const op = tokens[i]!;
      if (op.value !== (directed ? '->' : '--')) {
        throw lineError('DOT', op.line, `a ${directed ? 'digraph' : 'graph'} joins nodes with "${directed ? '->' : '--'}", not "${op.value}"`);
      }
      i++;
      ends.push(keyword(peek(), 'subgraph') || is('{') ? subgraph() : nodeRef());
    }
    return { kind: 'edge', ends, attrs: attrList(), line };
  }
}
