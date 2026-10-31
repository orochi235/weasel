/** A Mermaid xychart's text as statements, each with the line it came from. */
import { lineError } from '../../lineError';

/** One statement of an xychart, by the keyword that starts it. */
export type XyStatement =
  | { kind: 'title'; text: string; line: number }
  | { kind: 'x-axis'; title?: string; categories?: string[]; range?: [number, number]; line: number }
  | { kind: 'y-axis'; title?: string; range?: [number, number]; line: number }
  | { kind: 'bar' | 'line'; name?: string; values: number[]; line: number }
  | { kind: 'dropped'; what: string; line: number };

/** An xychart's header and statements, and the front matter's title. */
export interface XyChartText {
  orientation: 'vertical' | 'horizontal';
  statements: XyStatement[];
  /** `title:` from the front matter. */
  frontTitle?: string;
  /** How many lines of front matter other than its title were skipped. */
  frontOther: number;
}

const FORMAT = 'Mermaid';
const HEADER = /^xychart(?:-beta)?(?:\s+(horizontal|vertical))?\s*$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** A quoted string's text, with Mermaid's `#quot;` entity read back as a quote. */
export const unquote = (s: string): string => s.slice(1, -1).replace(/#quot;/g, '"');

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

function numberAt(text: string, line: number): number {
  if (!NUMBER.test(text)) throw lineError(FORMAT, line, `"${text}" is not a number`);
  return Number(text);
}

/** A leading quoted title off `rest`, and what follows it. */
function leadingTitle(rest: string): { title?: string; rest: string } {
  const m = /^("[^"]*")\s*(.*)$/.exec(rest);
  return m === null ? { rest } : { title: unquote(m[1]!), rest: m[2]! };
}

/** `[a, b]` as its items, or `min --> max` as a range; `null` for nothing; throws on anything else. */
function axisBody(rest: string, line: number): { categories?: string[]; range?: [number, number] } | null {
  if (rest === '') return null;
  if (rest.startsWith('[')) {
    if (!rest.endsWith(']')) throw lineError(FORMAT, line, 'a category list with no closing "]"');
    return { categories: listItems(rest.slice(1, -1)).map((c) => (c.startsWith('"') && c.endsWith('"') ? unquote(c) : c)) };
  }
  const m = /^(\S+)\s*-->\s*(\S+)$/.exec(rest);
  if (m === null) throw lineError(FORMAT, line, `"${rest}" is neither a category list nor a range`);
  return { range: [numberAt(m[1]!, line), numberAt(m[2]!, line)] };
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
      const values = listItems(body.slice(1, -1)).map((v) => numberAt(v, line));
      return { kind: keyword, ...(title !== undefined ? { name: title } : {}), values, line };
    }
    case 'accTitle:':
    case 'accDescr:':
      return { kind: 'dropped', what: keyword.slice(0, -1), line };
    default:
      throw lineError(FORMAT, line, `"${keyword}" is not an xychart statement`);
  }
}

/** Reads front matter off the top of `lines`: its title, and how many other lines it held. Returns the line after it. */
function frontMatter(lines: readonly string[], into: XyChartText): number {
  if (!/^---\s*$/.test(lines[0] ?? '')) return 0;
  let k = 1;
  for (; k < lines.length && !/^---\s*$/.test(lines[k]!); k++) {
    const m = /^title:\s*(.*)$/.exec(lines[k]!.trim());
    if (m !== null) into.frontTitle = /^".*"$/.test(m[1]!) ? JSON.parse(m[1]!) as string : m[1]!;
    else if (lines[k]!.trim() !== '') into.frontOther++;
  }
  return k + 1;
}

/** Parses an xychart. Throws, naming the line, on text that is not one. */
export function parseXyChart(text: string): XyChartText {
  const lines = text.split(/\r\n?|\n/);
  const out: XyChartText = { orientation: 'vertical', statements: [], frontOther: 0 };
  let header = false;
  let block = false;
  for (let k = frontMatter(lines, out); k < lines.length; k++) {
    const l = lines[k]!.trim();
    const line = k + 1;
    if (block) {
      block = !l.includes('}');
      continue;
    }
    if (l === '' || l.startsWith('%%')) {
      if (l.startsWith('%%{')) out.statements.push({ kind: 'dropped', what: 'directive', line });
      continue;
    }
    if (!header) {
      const m = HEADER.exec(l);
      if (m === null) throw lineError(FORMAT, line, `"${l}" is not an xychart header`);
      if (m[1] === 'horizontal') out.orientation = 'horizontal';
      header = true;
      continue;
    }
    if (/^accDescr\s*\{/.test(l)) {
      out.statements.push({ kind: 'dropped', what: 'accDescr', line });
      block = !l.includes('}');
      continue;
    }
    const m = /^(\S+)\s*(.*)$/.exec(l)!;
    out.statements.push(statementOf(m[1]!, m[2]!.trim(), line));
  }
  if (!header) throw lineError(FORMAT, lines.length, 'no xychart header');
  return out;
}
