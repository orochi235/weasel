/** One graph page as a Mermaid kanban board: a pool's lanes as columns, the shapes in each as its cards. */
import type { DataContainer, DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { IdMint } from '../../graphRead';
import { graphOut, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { fieldName, mermaidEscaped, mermaidIds, oneLine } from '../common/text';
import { CARD, COLUMN } from './read';

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
  readonly ids: Map<string, string>;
  readonly written = new Set<string>();
  /** Ids left unwritten, each one the reader gives back in its place. */
  readonly unwritten = new Set<string>();

  constructor(readonly out: GraphOut, pool: DataContainer | undefined) {
    const lanes = (out.page.data.containers ?? []).flatMap((c) => (c.lanes ?? []).map((l) => l.id));
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...lanes], { unicode: true, id: ITEM_ID });
    if (pool !== undefined) this.leaveUnwritten(pool);
  }

  /** Leaves out each id the reader would give back unwritten, minting as it does: the first it would not is written,
   *  which moves what the reader mints after it, so the board is minted again. */
  private leaveUnwritten(pool: DataContainer): void {
    const items = (pool.lanes ?? []).flatMap((lane, i) => [
      { id: lane.id, base: COLUMN, from: i + 1 },
      ...(lane.members ?? []).filter((id) => this.out.byId.has(id)).map((id) => ({ id, base: CARD, from: 1 })),
    ]);
    for (const { id } of items) if (GENERATED.test(id) && this.ids.get(id) === id) this.unwritten.add(id);
    for (let wrong: string | undefined = ''; wrong !== undefined;) {
      const mint = new IdMint(items.filter(({ id }) => !this.unwritten.has(id)).map(({ id }) => this.ids.get(id) ?? id));
      wrong = items.find(({ id, base, from }) => this.unwritten.has(id) && mint.next(base, from) !== id)?.id;
      if (wrong !== undefined) this.unwritten.delete(wrong);
    }
  }

  head(id: string): string {
    return this.unwritten.has(id) ? '' : this.ids.get(id) ?? id;
  }

  card(n: DataNode): void {
    this.written.add(n.id);
    const rows = n.rows ?? (n.lines ?? []).map((text) => ({ kind: 'label' as const, text }));
    const text = rows.flatMap((r) => (r.kind === 'label' ? [r.text] : [])).join(' ');
    const warn = (m: string) => this.out.warnings.add(m);
    const meta = rows.flatMap((r) => (r.kind === 'field' ? [`${fieldName(r.label, /[^\w-]+/g, 'kanban', warn)}: ${metaValue(oneLine(r.value, 'kanban', warn), warn)}`] : []));
    if (rows.some((r) => r.kind !== 'label' && r.kind !== 'field')) this.out.warnings.add('Mermaid kanban cards hold text and metadata only; other rows were dropped.');
    this.lines.push(`    ${this.head(n.id)}${bracketed(text)}${meta.length > 0 ? `@{ ${meta.join(', ')} }` : ''}`);
  }

  board(pool: DataContainer): void {
    for (const lane of pool.lanes ?? []) {
      this.lines.push(`  ${this.head(lane.id)}${bracketed(lane.label ?? lane.id)}`);
      for (const id of lane.members ?? []) {
        const n = this.out.byId.get(id);
        if (n !== undefined) this.card(n);
        else this.out.warnings.add('Mermaid kanban columns hold cards only; containers in them were dropped.');
      }
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
  if (pools[0] !== undefined) w.board(pools[0]);
  if (pools.length > 1 || (out.page.data.containers ?? []).some((c) => c.role !== 'pool')) {
    out.warnings.add('Mermaid kanban boards are one pool; other pools and containers were dropped.');
  }
  if (out.page.data.nodes.some((n) => !w.written.has(n.id))) out.warnings.add('Mermaid kanban cards sit in columns; shapes in none were dropped.');
  if (out.edges.length > 0) out.warnings.add('Mermaid kanban boards have no connectors; they were dropped.');
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
