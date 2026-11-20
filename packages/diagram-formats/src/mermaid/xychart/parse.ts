/** A Mermaid xychart's text as statements, each with the line it came from. */
import { decodeEntities } from '../../graphRead';
import { lineError } from '../../lineError';
import { requireNumber } from '../common/number';
import { frontMatter } from '../common/header';
import { statementsOf, type MermaidSource } from '../common/lines';

/** One statement of an xychart, by the keyword that starts it. */
export type XyStatement =
  | { kind: 'title'; text: string; line: number }
  | { kind: 'x-axis'; title?: string; categories?: string[]; range?: [number, number]; line: number }
  | { kind: 'y-axis'; title?: string; range?: [number, number]; line: number }
  | { kind: 'bar' | 'line'; name?: string; values: number[]; line: number };

/** An xychart's header and statements, and what came around them. */
export interface XyChartText {
  orientation: 'vertical' | 'horizontal';
  statements: XyStatement[];
  /** The source's front matter title, accessible text and directives, as every line-oriented kind reads them. */
  source: MermaidSource;
  /** How many lines of front matter other than its title were skipped. */
  frontOther: number;
}

const FORMAT = 'Mermaid';
const HEADER = /^xychart(?:-beta)?(?:\s+(horizontal|vertical))?\s*$/;

/** A quoted string's text, its Mermaid and HTML references read, as `mermaidQuoted` writes them. */
export const unquote = (s: string): string => decodeEntities(s.slice(1, -1), true);

/** Splits `list` (what lies between the brackets) on commas outside quotes. */
function listItems(list: string): string[] {
  const out: string[] = [];
  let at = 0;
  let quoted = false;
  for (let i = 0; i <= list.length; i++) {
    const c = list[i];
    if (c === '"') quoted = !quoted;
    if (i === list.length || (c === ',' && !quoted)) {
      out.push(list.slice(at, i).trim());
      at = i + 1;
    }
  }
  return out.length === 1 && out[0] === '' ? [] : out;
}


const RANGE = /^(\S+)\s*-->\s*(\S+)$/;

/** A leading title off `rest`, quoted or one bare word as Mermaid's grammar takes it, and what follows it. */
function leadingTitle(rest: string): { title?: string; rest: string } {
  const m = /^("[^"]*")\s*(.*)$/s.exec(rest);
  if (m !== null) return { title: unquote(m[1]!), rest: m[2]! };
  if (rest === '' || rest.startsWith('[') || RANGE.test(rest)) return { rest };
  const w = /^(\S+)\s*(.*)$/s.exec(rest)!;
  return { title: w[1]!, rest: w[2]! };
}

/** `[a, b]` as its items, or `min --> max` as a range; `null` for nothing; throws on anything else. */
function axisBody(rest: string, line: number): { categories?: string[]; range?: [number, number] } | null {
  if (rest === '') return null;
  if (rest.startsWith('[')) {
    if (!rest.endsWith(']')) throw lineError(FORMAT, line, 'a category list with no closing "]"');
    return { categories: listItems(rest.slice(1, -1)).map((c) => (c.startsWith('"') && c.endsWith('"') ? unquote(c) : c)) };
  }
  const m = RANGE.exec(rest);
  if (m === null) throw lineError(FORMAT, line, `"${rest}" is neither a category list nor a range`);
  return { range: [requireNumber(m[1]!, line), requireNumber(m[2]!, line)] };
}

function statementOf(keyword: string, rest: string, line: number): XyStatement {
  switch (keyword) {
    case 'title':
      return { kind: 'title', text: rest.startsWith('"') && rest.endsWith('"') && rest.length > 1 ? unquote(rest) : rest, line };
    case 'x-axis':
    case 'y-axis': {
      const { title, rest: body } = leadingTitle(rest);
      const parsed = axisBody(body, line);
      if (keyword === 'y-axis' && parsed?.categories) throw lineError(FORMAT, line, 'the y axis takes a range, not categories');
      return { kind: keyword, ...(title !== undefined ? { title } : {}), ...parsed, line } as XyStatement;
    }
    case 'bar':
    case 'line': {
      const { title, rest: body } = leadingTitle(rest);
      if (!body.startsWith('[') || !body.endsWith(']')) throw lineError(FORMAT, line, `a ${keyword} series needs its values in brackets`);
      const values = listItems(body.slice(1, -1)).map((v) => requireNumber(v, line));
      return { kind: keyword, ...(title !== undefined ? { name: title } : {}), values, line };
    }
    default:
      throw lineError(FORMAT, line, `"${keyword}" is not an xychart statement`);
  }
}

/** How many lines of `text`'s front matter are neither blank nor its title. */
function frontOther(text: string): number {
  const front = frontMatter(text.replace(/\r\n?/g, '\n'));
  if (front.length === 0) return 0;
  return text.replace(/\r\n?/g, '\n').slice(0, front.length).split('\n').slice(1, front.lines - 1)
    .filter((l) => l.trim() !== '' && !/^title:/.test(l.trim())).length;
}

/** Parses an xychart. Throws, naming the line, on text that is not one. */
export function parseXyChart(text: string): XyChartText {
  const source = statementsOf(text);
  const m = HEADER.exec(source.header.text);
  if (m === null) throw lineError(FORMAT, source.header.line, `"${source.header.text}" is not an xychart header`);
  const statements = source.body.map((s) => {
    const k = /^(\S+)\s*(.*)$/s.exec(s.text)!;
    return statementOf(k[1]!, k[2]!.trim(), s.line);
  });
  return { orientation: m[1] === 'horizontal' ? 'horizontal' : 'vertical', statements, source, frontOther: frontOther(text) };
}
