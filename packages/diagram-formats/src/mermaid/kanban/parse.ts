/** A Mermaid kanban board's grammar: columns, and the cards indented under each, with each one's line. */
import { lineError } from '../../lineError';
import { statementsOf, type MermaidSource } from '../common/lines';
import { metaEnd, metaOf } from '../common/meta';

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

const ITEM = /^([\p{L}\p{N}_][\p{L}\p{N}_-]*)?(?:\[(.*)\])?$/us;

/** Where `text`'s `@{ … }` metadata opens: the first `@{`, after the closing `]` of a label, whose metadata closes
 *  at the end of the line, so a `]@{` inside a quoted value is not taken for one. -1 for none. */
function metaStart(text: string): number {
  for (const m of text.matchAll(/(?:^[\p{L}\p{N}_][\p{L}\p{N}_-]*|\])\s*@\{/gu)) {
    const open = m.index + m[0].length;
    if (metaEnd(text, open) === text.length - 1) return open;
  }
  return -1;
}

function itemOf(text: string, line: number): KanbanItem {
  const open = metaStart(text);
  const head = open < 0 ? text : text.slice(0, text.lastIndexOf('@', open)).trimEnd();
  const m = ITEM.exec(head);
  if (m === null || (m[1] === undefined && m[2] === undefined)) throw lineError('Mermaid', line, `cannot read "${text}" as a column or a card`);
  const [, id, label] = m as unknown as (string | undefined)[];
  const meta = open < 0 ? [] : metaOf(text.slice(open, -1), line, 'card metadata');
  return { ...(id !== undefined ? { id } : {}), text: (label ?? id!).trim(), meta, line };
}

/** Parses a Mermaid kanban board: a line at the shallowest indent is a column, a deeper one a card in it. Throws,
 *  naming the line, on text that is not one. */
export function parseKanban(text: string): KanbanBoard {
  const source = statementsOf(text);
  if (source.header.text !== 'kanban') throw lineError('Mermaid', source.header.line, `expected a kanban header, found "${source.header.text}"`);
  const top = source.body.reduce((m, s) => Math.min(m, s.indent), Infinity);
  const columns: KanbanBoard['columns'] = [];
  for (const s of source.body) {
    const item = itemOf(s.text, s.line);
    if (s.indent === top) columns.push({ ...item, cards: [] });
    else if (columns.length === 0) throw lineError('Mermaid', s.line, 'a card comes before any column');
    else columns.at(-1)!.cards.push(item);
  }
  return { source, columns };
}
