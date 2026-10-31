/**
 * A Mermaid kanban board as a one-page document: one pool whose lanes run
 * along `x`, a lane per column, and each card a node in its column's lane,
 * its text wrapped into label rows and its metadata as `field` rows.
 */
import type { DataContainer, DataNode, Row } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Warnings, decodeEntities, graphPage } from '../../graphRead';
import { PAGE_MARGIN } from '../../pageLayout';
import { lineError } from '../../lineError';
import { pageNameOf } from '../common/lines';
import { wrapped } from '../common/text';
import { parseKanban } from './parse';

/** A card's width, and a column's: wide enough for one card, so cards stack down it. */
export const CARD_WIDTH = 180;
export const COLUMN_WIDTH = 220;
/** A card's text wraps at this many characters. */
const CARD_WRAP = 26;
/** The pool's id, unless a card or column already has it. */
export const BOARD_ID = 'board';
/** The id a column or card giving none reads as, by its place among them. */
export const columnId = (n: number): string => `column-${n}`;
export const cardId = (n: number): string => `card-${n}`;

/** Room above a column's first card (the pool's header and the lane's), below each card, and a card's row height,
 *  for sizing the board to hold its longest column before the cards are measured. */
const HEADERS = 72;
const GAP = 12;
const ROW = 18;

/** A card's rows: its text, wrapped, then a `field` row per metadata pair. */
export const cardRows = (text: string, meta: readonly [string, string][]): Row[] => [
  ...wrapped(text, CARD_WRAP).map((t): Row => ({ kind: 'label', text: t })),
  ...meta.map(([label, value]): Row => ({ kind: 'field', label, value })),
];

/** Reads a Mermaid kanban board into a one-page document of `notation` `'kanban'`. Throws, naming the line, on text
 *  that is not one, or on an id two items share. */
export function readKanban(text: string): ImportResult {
  const { source, columns } = parseKanban(text);
  const warnings = new Warnings();
  const ids = new Set<string>();
  const claim = (id: string, line: number) => {
    if (ids.has(id)) throw lineError('Mermaid', line, `"${id}" names two items`);
    ids.add(id);
    return id;
  };
  let cards = 0;
  const nodes: DataNode[] = [];
  const lanes = columns.map((c, i) => {
    const lane = claim(c.id ?? columnId(i + 1), c.line);
    const members = c.cards.map((card) => {
      const id = claim(card.id ?? cardId(++cards), card.line);
      nodes.push({ id, rows: cardRows(decodeEntities(card.text, true), card.meta), width: CARD_WIDTH });
      return id;
    });
    if (c.meta.length > 0) warnings.add('Mermaid kanban column metadata was dropped.');
    return { id: lane, label: decodeEntities(c.text, true), size: COLUMN_WIDTH, ...(members.length > 0 ? { members } : {}) };
  });
  let board = BOARD_ID;
  for (let n = 2; ids.has(board); n++) board = `${BOARD_ID}-${n}`;
  const tallest = Math.max(0, ...columns.map((c) => c.cards.reduce((h, card) => h + (wrapped(card.text, CARD_WRAP).length + card.meta.length) * ROW + 16 + GAP, 0)));
  const name = pageNameOf(source, warnings);
  const pool: DataContainer = {
    id: board, role: 'pool', axis: 'x', lanes, ...(name !== undefined ? { label: name } : {}),
    box: { x: PAGE_MARGIN, y: PAGE_MARGIN, width: COLUMN_WIDTH * Math.max(1, lanes.length), height: HEADERS + GAP + tallest },
  };
  const page = graphPage({ ...(name !== undefined ? { name } : {}), nodes, edges: [], containers: [pool] });
  return { document: { pages: [{ ...page, notation: 'kanban' }] }, warnings: warnings.all() };
}
