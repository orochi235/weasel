/** One graph page as a Mermaid kanban board: a pool's lanes as columns, the shapes in each as its cards. */
import type { DataContainer, DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { IdMint } from '../../graphRead';
import { graphOut, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { fieldName, mermaidEscaped, mermaidIds, oneLine } from '../common/text';
import { CARD, COLUMN } from './read';
import { freshId } from '@weasel-js/registry';

type Lane = NonNullable<DataContainer['lanes']>[number];

const GENERATED = /^(?:column|card)-\d+$/;
/** An id as the kanban reader takes one. */
const ITEM_ID = /^[\p{L}\p{N}_][\p{L}\p{N}_-]*$/u;

/** A metadata value, quoted with whichever quote it does not hold; one holding both has its double quotes written as
 *  single ones, which `warn` hears. */
function metaValue(v: string, warn: (message: string) => void): string {
  if (!v.includes("'")) return `'${v}'`;
  if (v.includes('"')) warn('Mermaid kanban metadata values hold one kind of quote; double quotes were written as single ones.');
  return `"${v.replace(/"/g, "'")}"`;
}

/** Text in a column's or card's brackets: one line, a closing bracket written as a reference. */
const bracketed = (text: string): string => `[${mermaidEscaped([text], { also: /\]/g })}]`;

class KanbanWriter {
  readonly lines: string[] = [];
  readonly written = new Set<string>();
  /** Each node's id as written. */
  private readonly cardIds: Map<string, string>;
  /** Each of the pool's lanes, its id as written, and its cards, a node two lanes list in the first only. */
  private readonly columns: { lane: Lane; id: string; cards: DataNode[] }[] = [];
  /** Written ids left off, each one the reader gives back in its place. */
  private readonly unwritten = new Set<string>();

  constructor(readonly out: GraphOut, pool: DataContainer | undefined) {
    const lanes = (out.page.data.containers ?? []).flatMap((c) => (c.lanes ?? []).map((l) => l.id));
    const ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...lanes], { unicode: true, id: ITEM_ID, keywords: [] });
    this.cardIds = ids;
    const placed = new Set<string>();
    const cards = (pool?.lanes ?? []).map((lane) => (lane.members ?? []).flatMap((id) => {
      const n = out.byId.get(id);
      if (n === undefined) out.warnings.add('Mermaid kanban columns hold cards only; containers in them were dropped.');
      if (n === undefined || placed.has(id)) return [];
      placed.add(id);
      return [n];
    }));
    // The reader keeps columns and cards in one namespace, where `DiagramData` keeps lanes and nodes apart.
    const used = new Set(cards.flat().map((n) => ids.get(n.id)!));
    (pool?.lanes ?? []).forEach((lane, i) => {
      const own = ids.get(lane.id)!;
      const id = used.has(own) ? freshId(own, used, { from: 2, sep: '_' }) : own;
      used.add(id);
      this.columns.push({ lane, id, cards: cards[i]! });
    });
    this.leaveUnwritten();
  }

  /** Leaves out each id the reader would give back unwritten, minting as it does: the first it would not is written,
   *  which moves what the reader mints after it, so the board is minted again. */
  private leaveUnwritten(): void {
    const items = this.columns.flatMap(({ lane, id, cards }, i) => [
      { source: lane.id, id, base: COLUMN, from: i + 1 },
      ...cards.map((n) => ({ source: n.id, id: this.cardIds.get(n.id)!, base: CARD, from: 1 })),
    ]);
    for (const { source, id } of items) if (GENERATED.test(source) && id === source) this.unwritten.add(id);
    for (let wrong: string | undefined = ''; wrong !== undefined;) {
      const mint = new IdMint(items.filter(({ id }) => !this.unwritten.has(id)).map(({ id }) => id));
      wrong = items.find(({ id, base, from }) => this.unwritten.has(id) && mint.next(base, from) !== id)?.id;
      if (wrong !== undefined) this.unwritten.delete(wrong);
    }
  }

  head(id: string): string {
    return this.unwritten.has(id) ? '' : id;
  }

  card(n: DataNode): void {
    this.written.add(n.id);
    const rows = n.rows ?? (n.lines ?? []).map((text) => ({ kind: 'label' as const, text }));
    const text = rows.flatMap((r) => (r.kind === 'label' ? [r.text] : [])).join(' ');
    const warn = (m: string) => this.out.warnings.add(m);
    const meta = rows.flatMap((r) => (r.kind === 'field' ? [`${fieldName(r.label, /[^\w-]+/g, 'kanban', warn)}: ${metaValue(oneLine(r.value, 'kanban', warn), warn)}`] : []));
    if (rows.some((r) => r.kind !== 'label' && r.kind !== 'field')) this.out.warnings.add('Mermaid kanban cards hold text and metadata only; other rows were dropped.');
    this.lines.push(`    ${this.head(this.cardIds.get(n.id)!)}${bracketed(text)}${meta.length > 0 ? `@{ ${meta.join(', ')} }` : ''}`);
  }

  board(): void {
    for (const { lane, id, cards } of this.columns) {
      this.lines.push(`  ${this.head(id)}${bracketed(lane.label ?? lane.id)}`);
      for (const n of cards) this.card(n);
    }
  }
}

/** Writes the page `opts.page` names, else the first, as a Mermaid kanban board: its first pool's lanes as columns. */
export function writeKanban(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid', true);
  if (out === null) return { text: 'kanban\n', warnings: [] };
  const pools = (out.page.data.containers ?? []).filter((c) => c.role === 'pool');
  const w = new KanbanWriter(out, pools[0]);
  w.lines.push(...titleLines(out.page.name), 'kanban');
  w.board();
  if (pools.length > 1 || (out.page.data.containers ?? []).some((c) => c.role !== 'pool')) {
    out.warnings.add('Mermaid kanban boards are one pool; other pools and containers were dropped.');
  }
  if (out.page.data.nodes.some((n) => !w.written.has(n.id))) out.warnings.add('Mermaid kanban cards sit in columns; shapes in none were dropped.');
  if (out.edges.length > 0) out.warnings.add('Mermaid kanban boards have no connectors; they were dropped.');
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
