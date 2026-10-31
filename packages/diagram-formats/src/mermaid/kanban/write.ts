/** One graph page as a Mermaid kanban board: a pool's lanes as columns, the shapes in each as its cards. */
import type { DataContainer, DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { graphOut, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { mermaidIds } from '../common/text';

const GENERATED = /^(?:column|card)-\d+$/;

/** A metadata value, quoted with whichever quote it does not hold. */
const metaValue = (v: string): string => (v.includes("'") ? `"${v.replace(/"/g, "'")}"` : `'${v}'`);

/** Text in a column's or card's brackets: one line, no closing bracket. */
const bracketed = (text: string): string => `[${text.replace(/\]/g, ')')}]`;

class KanbanWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  readonly written = new Set<string>();

  constructor(readonly out: GraphOut) {
    const lanes = (out.page.data.containers ?? []).flatMap((c) => (c.lanes ?? []).map((l) => l.id));
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...lanes]);
  }

  head(id: string): string {
    return GENERATED.test(id) ? '' : this.ids.get(id) ?? id;
  }

  card(n: DataNode): void {
    this.written.add(n.id);
    const rows = n.rows ?? (n.lines ?? []).map((text) => ({ kind: 'label' as const, text }));
    const text = rows.flatMap((r) => (r.kind === 'label' ? [r.text] : [])).join(' ');
    const meta = rows.flatMap((r) => (r.kind === 'field' ? [`${r.label}: ${metaValue(r.value)}`] : []));
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
  const w = new KanbanWriter(out);
  w.lines.push(...titleLines(out.page.name), 'kanban');
  const pools = (out.page.data.containers ?? []).filter((c) => c.role === 'pool');
  if (pools[0] !== undefined) w.board(pools[0]);
  if (pools.length > 1 || (out.page.data.containers ?? []).some((c) => c.role !== 'pool')) {
    out.warnings.add('Mermaid kanban boards are one pool; other pools and containers were dropped.');
  }
  if (out.page.data.nodes.some((n) => !w.written.has(n.id))) out.warnings.add('Mermaid kanban cards sit in columns; shapes in none were dropped.');
  if (out.edges.length > 0) out.warnings.add('Mermaid kanban boards have no connectors; they were dropped.');
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
