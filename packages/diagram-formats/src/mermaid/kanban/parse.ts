/** A Mermaid kanban board's grammar: columns, and the cards indented under each, with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource } from '../common/lines';

/** A column or card: its id when it gives one, its text, and a card's `@{ … }` metadata in order. */
export interface KanbanItem {
  id?: string;
  text: string;
  meta: [string, string][];
  line: number;
}

/** A whole board. */
export interface KanbanBoard {
  source: MermaidSource;
  columns: (KanbanItem & { cards: KanbanItem[] })[];
}

const ITEM = /^([\p{L}\p{N}_][\p{L}\p{N}_-]*)?(?:\[(.*)\])?\s*(?:@\{(.*)\})?$/u;

/** `ticket: MC-1, assigned: 'knsv'` as its pairs, values unquoted. */
export function metaOf(meta: string, line: number): [string, string][] {
  const out: [string, string][] = [];
  const text = meta.trim();
  const re = /\s*([\w-]+)\s*:\s*('[^']*'|"[^"]*"|[^,]*?)\s*(?:,|$)/y;
  for (re.lastIndex = 0; re.lastIndex < text.length;) {
    const at = re.lastIndex;
    const m = re.exec(text);
    if (m === null || m[0] === '') throw lineError('Mermaid', line, `cannot read "${text.slice(at).trim()}" as card metadata`);
    out.push([m[1]!, /^(['"]).*\1$/.test(m[2]!) ? m[2]!.slice(1, -1) : m[2]!]);
  }
  return out;
}

function itemOf(text: string, line: number): KanbanItem {
  const m = ITEM.exec(text);
  if (m === null || (m[1] === undefined && m[2] === undefined)) throw lineError('Mermaid', line, `cannot read "${text}" as a column or a card`);
  const [, id, label, meta] = m as unknown as (string | undefined)[];
  return { ...(id !== undefined ? { id } : {}), text: (label ?? id!).trim(), meta: meta !== undefined ? metaOf(meta, line) : [], line };
}

/** Parses a Mermaid kanban board: a line at the shallowest indent is a column, a deeper one a card in it. Throws,
 *  naming the line, on text that is not one. */
export function parseKanban(text: string): KanbanBoard {
  const source = statementsOf(text);
  if (source.header.text !== 'kanban') throw lineError('Mermaid', source.header.line, `expected a kanban header, found "${source.header.text}"`);
  const top = Math.min(...source.body.map((s) => s.indent));
  const columns: KanbanBoard['columns'] = [];
  for (const s of source.body) {
    const item = itemOf(s.text, s.line);
    if (s.indent === top) columns.push({ ...item, cards: [] });
    else if (columns.length === 0) throw lineError('Mermaid', s.line, 'a card comes before any column');
    else columns.at(-1)!.cards.push(item);
  }
  return { source, columns };
}
