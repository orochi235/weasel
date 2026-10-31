/** A Mermaid C4 diagram's grammar: macro calls, boundaries opened by `{`, and a title, each with its line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource } from '../common/lines';

/** A macro's arguments: positional ones in order, and `$name=value` ones by name. */
export interface C4Args {
  positional: string[];
  named: Record<string, string>;
}

export type C4Stmt =
  | { kind: 'call'; macro: string; args: C4Args; body?: C4Stmt[]; line: number }
  | { kind: 'title'; text: string; line: number };

/** A whole C4 diagram, and the header naming which of the five it is. */
export interface C4Diagram {
  source: MermaidSource;
  header: C4Header;
  stmts: C4Stmt[];
}

/** The five C4 headers. */
export const C4_HEADERS = ['C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'] as const;
export type C4Header = (typeof C4_HEADERS)[number];

/** Splits a macro's arguments on commas outside quotes, each a quoted string, a bare word, or `$name=value`. */
export function argsOf(text: string): C4Args {
  const parts: string[] = [];
  let at = '';
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    if (c === ',' && !quoted) {
      parts.push(at);
      at = '';
    } else at += c;
  }
  if (at.trim() !== '' || parts.length > 0) parts.push(at);
  const value = (v: string) => (/^".*"$/s.test(v) ? v.slice(1, -1) : v);
  const args: C4Args = { positional: [], named: {} };
  for (const p of parts.map((s) => s.trim())) {
    const named = /^\$(\w+)\s*=\s*(.*)$/s.exec(p);
    if (named !== null) args.named[named[1]!] = value(named[2]!.trim());
    else args.positional.push(value(p));
  }
  return args;
}

const CALL = /^(\w+)\s*\((.*)\)\s*(\{)?$/;

/** Statements up to the `}` closing a boundary opened on line `opened`, or to the end when `opened` is null. */
function block(lines: MermaidSource['body'], at: { i: number }, opened: number | null): C4Stmt[] {
  const out: C4Stmt[] = [];
  while (at.i < lines.length) {
    const { text, line } = lines[at.i++]!;
    if (text === '}') {
      if (opened === null) throw lineError('Mermaid', line, '"}" closes no boundary');
      return out;
    }
    const title = /^title\s+(.*)$/.exec(text);
    if (title !== null) {
      out.push({ kind: 'title', text: title[1]!.trim(), line });
      continue;
    }
    const call = CALL.exec(text);
    if (call === null) throw lineError('Mermaid', line, `cannot read "${text}" as a C4 statement`);
    const args = argsOf(call[2]!);
    out.push({ kind: 'call', macro: call[1]!, args, line, ...(call[3] !== undefined ? { body: block(lines, at, line) } : {}) });
  }
  if (opened !== null) throw lineError('Mermaid', opened, 'a boundary opened here is never closed');
  return out;
}

/** Parses a Mermaid C4 diagram. Throws, naming the line, on text that is not one. */
export function parseC4(text: string): C4Diagram {
  const source = statementsOf(text);
  const header = C4_HEADERS.find((h) => h === source.header.text);
  if (header === undefined) throw lineError('Mermaid', source.header.line, `expected a C4 header, found "${source.header.text}"`);
  return { source, header, stmts: block(source.body, { i: 0 }, null) };
}
