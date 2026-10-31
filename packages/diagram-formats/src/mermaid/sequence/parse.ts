/**
 * A Mermaid `sequenceDiagram` as a list of statements, one per line, each
 * with its line number. Says nothing about whether the statements make sense
 * together; `readMermaidSequence` does.
 */
import { lineError } from '../../lineError';
import { ARROWS, type Arrow } from './syntax';

/** Fragment keywords and the section keyword each continues with. */
export const FRAGMENTS = { loop: null, alt: 'else', opt: null, par: 'and', critical: 'option', break: null } as const;
export type FragmentWord = keyof typeof FRAGMENTS;

/** One statement of a sequence diagram. */
export type SeqStmt = { line: number } & (
  | { kind: 'participant'; id: string; type: string; label?: string; create: boolean }
  | { kind: 'message'; from: string; to: string; arrow: Arrow; mark: '+' | '-' | ''; text: string }
  | { kind: 'note'; place: 'left of' | 'right of' | 'over'; over: string[]; text: string }
  | { kind: 'activate' | 'deactivate' | 'destroy'; participant: string }
  | { kind: 'fragment'; word: FragmentWord; label: string }
  | { kind: 'section'; word: 'else' | 'and' | 'option'; label: string }
  | { kind: 'rect'; color: string }
  | { kind: 'box'; rest: string }
  | { kind: 'end' }
  | { kind: 'autonumber'; args: string[] }
  | { kind: 'title'; text: string }
  | { kind: 'dropped'; what: string }
);

/** What {@link parseSequence} reads: the statements, the front matter's title, and what it dropped along the way. */
export interface ParsedSequence {
  stmts: SeqStmt[];
  title?: string;
  dropped: string[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MESSAGE = new RegExp(`^(.+?)\\s*(${ARROWS.map(([a]) => escape(a)).join('|')})\\s*([+-]?)\\s*([^:]+?)\\s*(?::(.*))?$`);
const NOTE = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:(.*)$/i;
const DECLARE = /^(create\s+)?(participant|actor)\s+(.+)$/i;

/** A declaration's id, its `@{ ... }` type and alias, and its `as` label. */
function declaration(rest: string, word: string, create: boolean, line: number): SeqStmt {
  const as = /\s+as\s+(.+)$/i.exec(rest);
  const head = (as === null ? rest : rest.slice(0, as.index)).trim();
  const meta = /^([^@\s]+)\s*@\{(.*)\}$/.exec(head);
  const id = meta === null ? head : meta[1]!;
  if (id === '' || /\s/.test(id)) throw lineError('Mermaid', line, `"${head}" is not a participant id`);
  const type = (meta && /"type"\s*:\s*"([^"]*)"/.exec(meta[2]!)?.[1]) ?? word.toLowerCase();
  const alias = meta ? /"alias"\s*:\s*"([^"]*)"/.exec(meta[2]!)?.[1] : undefined;
  const label = as?.[1]!.trim() ?? alias;
  return { kind: 'participant', id, type, ...(label !== undefined ? { label } : {}), create, line };
}

/** One line's statement, or `null` for a blank or a comment. */
function statementOf(text: string, line: number, dropped: string[]): SeqStmt | null {
  const t = text.trim().replace(/;$/, '').trim();
  if (t === '' || t.startsWith('%%')) {
    if (/^%%\{.*\}%%$/.test(t)) dropped.push('Mermaid configuration directives were dropped.');
    return null;
  }
  const word = /^\S+/.exec(t)![0].toLowerCase();
  const rest = t.slice(word.length).trim();
  const declare = DECLARE.exec(t);
  if (declare) return declaration(declare[3]!, declare[2]!, declare[1] !== undefined, line);
  if (word === 'end') return { kind: 'end', line };
  if (word in FRAGMENTS) return { kind: 'fragment', word: word as FragmentWord, label: rest, line };
  if (word === 'else' || word === 'and' || word === 'option') return { kind: 'section', word, label: rest, line };
  if (word === 'rect') return { kind: 'rect', color: rest, line };
  if (word === 'box') return { kind: 'box', rest, line };
  if (word === 'activate' || word === 'deactivate' || word === 'destroy') return { kind: word, participant: rest, line };
  if (word === 'autonumber') return { kind: 'autonumber', args: rest === '' ? [] : rest.split(/\s+/), line };
  if (/^title\b/i.test(t)) return { kind: 'title', text: t.replace(/^title\s*:?\s*/i, ''), line };
  if (/^acc(Title|Descr)\b/.test(t)) return { kind: 'dropped', what: 'Accessibility titles and descriptions were dropped.', line };
  if (/^(links?|properties|details)\b/i.test(t)) return { kind: 'dropped', what: 'Participant menus (links, properties, details) were dropped.', line };
  const note = NOTE.exec(t);
  if (note) {
    const over = note[2]!.split(',').map((s) => s.trim()).filter((s) => s !== '');
    return { kind: 'note', place: note[1]!.toLowerCase() as 'over', over, text: note[3]!, line };
  }
  const msg = MESSAGE.exec(t);
  if (msg) {
    const arrow = ARROWS.find(([a]) => a === msg[2])![1];
    return { kind: 'message', from: msg[1]!.trim(), to: msg[4]!.trim(), arrow, mark: msg[3] as '+' | '-' | '', text: msg[5] ?? '', line };
  }
  throw lineError('Mermaid', line, `"${t}" is not a sequence diagram statement`);
}

/** The lines of `text` after its front matter, numbered from the file's first line, and the front matter's title. */
function body(text: string, dropped: string[]): { lines: string[]; first: number; title?: string } {
  const lines = text.split(/\r\n?|\n/);
  if (!/^---\s*$/.test(lines[0] ?? '')) return { lines, first: 1 };
  const close = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l));
  if (close < 0) throw lineError('Mermaid', 1, 'the front matter is never closed with ---');
  const front = lines.slice(1, close);
  const raw = front.map((l) => /^title:\s*(.*)$/.exec(l)?.[1]).find((t) => t !== undefined)?.trim();
  if (front.some((l) => /^(config|displayMode):/.test(l))) dropped.push('Mermaid configuration in the front matter was dropped.');
  const title = raw === undefined ? undefined : /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
  return { lines: lines.slice(close + 1), first: close + 2, ...(title !== undefined ? { title } : {}) };
}

/** Parses a Mermaid sequence diagram into statements. Throws, naming the line, on text that is not one. */
export function parseSequence(text: string): ParsedSequence {
  const dropped: string[] = [];
  const { lines, first, title } = body(text, dropped);
  const stmts: SeqStmt[] = [];
  let header = false;
  let inDescr = false;
  lines.forEach((raw, k) => {
    const line = first + k;
    if (inDescr) {
      inDescr = !raw.includes('}');
      return;
    }
    if (/^\s*accDescr\s*\{/.test(raw)) {
      dropped.push('Accessibility titles and descriptions were dropped.');
      inDescr = !raw.includes('}');
      return;
    }
    if (!header) {
      const t = raw.trim();
      if (t === '' || t.startsWith('%%')) {
        statementOf(t, line, dropped);
        return;
      }
      if (!/^sequenceDiagram\b/.test(t)) throw lineError('Mermaid', line, `expected "sequenceDiagram", found "${t}"`);
      header = true;
      return;
    }
    const stmt = statementOf(raw, line, dropped);
    if (stmt !== null) stmts.push(stmt);
  });
  if (!header) throw lineError('Mermaid', first, 'expected "sequenceDiagram", found the end of the file');
  return { stmts, ...(title !== undefined ? { title } : {}), dropped };
}
