/** One graph page as a Mermaid block diagram: its grid layout's columns, spans, and spaces, and containers as groups. */
import type { DataEdge, DataNode, GridOptions } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { edgeStyleIn, graphOut, nodeLines, type Cluster, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { styleProps } from '../common/styles';
import { mermaidIds, mermaidText } from '../common/text';
import { BRACKETS } from '../flowchart/write';

const ANONYMOUS = /^block-\d+$/;

type Item = { node: DataNode } | { cluster: Cluster };

class BlockWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  readonly grid: GridOptions;
  readonly order: ReadonlyMap<string, number>;

  constructor(readonly out: GraphOut) {
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...out.clusterIds]);
    this.grid = out.page.layout?.name === 'grid' ? out.page.layout.options?.grid ?? {} : {};
    this.order = new Map(out.page.data.nodes.map((n, i) => [n.id, i]));
  }

  id(id: string): string {
    return this.ids.get(id) ?? id;
  }

  /** Where an item stands among its level's: its first node's place in the page. */
  first(item: Item): number {
    if ('node' in item) return this.order.get(item.node.id)!;
    const c = item.cluster;
    return Math.min(Infinity, ...c.nodes.map((id) => this.order.get(id)!), ...c.clusters.map((k) => this.first({ cluster: k })));
  }

  span(id: string): string {
    const n = this.grid.spans?.[id];
    return n !== undefined && n > 1 ? `:${n}` : '';
  }

  level(nodes: readonly DataNode[], clusters: readonly Cluster[], indent: string): void {
    const items: Item[] = [...nodes.map((node) => ({ node })), ...clusters.map((cluster) => ({ cluster }))];
    items.sort((a, b) => this.first(a) - this.first(b));
    for (const item of items) {
      const id = 'node' in item ? item.node.id : item.cluster.id;
      const skip = this.grid.skips?.[id] ?? 0;
      if (skip > 0) this.lines.push(`${indent}${skip === 1 ? 'space' : `space:${skip}`}`);
      if ('node' in item) this.lines.push(`${indent}${this.block(item.node)}${this.span(id)}`);
      else this.group(item.cluster, indent);
    }
  }

  block(node: DataNode): string {
    const text = nodeLines(node, this.out.warnings, 'Mermaid');
    const outline = node.outline ?? 'rect';
    const brackets = typeof outline === 'string' ? BRACKETS[outline] : undefined;
    if (brackets === undefined) this.out.warnings.add('Mermaid has no bracket shape for some outlines; they were written as rectangles.');
    const id = this.id(node.id);
    if (outline === 'rect' && id === node.id && text.length === 1 && text[0] === id) return id;
    const [open, close] = brackets ?? BRACKETS.rect!;
    return `${id}${open}${mermaidText(text)}${close}`;
  }

  group(c: Cluster, indent: string): void {
    const named = !ANONYMOUS.test(c.id) || this.span(c.id) !== '';
    this.lines.push(`${indent}block${named ? `:${this.id(c.id)}${this.span(c.id)}` : ''}`);
    const columns = this.grid.groupColumns?.[c.id];
    if (columns !== undefined) this.lines.push(`${indent}  columns ${columns}`);
    this.level(c.nodes.map((id) => this.out.byId.get(id)!), c.clusters, `${indent}  `);
    this.lines.push(`${indent}end`);
    if (c.label !== undefined) this.out.warnings.add('Mermaid block groups have no titles; container titles were dropped.');
  }

  link(e: DataEdge): string {
    const { markerStart, markerEnd, dash, width } = edgeStyleIn(this.out, e);
    const body = dash !== undefined ? '-.-' : (width ?? 0) >= 3 ? '==' : '--';
    const end = markerEnd !== null && markerEnd !== undefined;
    const start = markerStart !== null && markerStart !== undefined;
    const tail = end ? '>' : body === '--' ? '-' : body === '==' ? '=' : '';
    const from = this.id(e.from);
    const to = this.id(e.to);
    if (e.label !== undefined && e.label !== '') {
      const open = body === '-.-' ? '-.' : body;
      return `  ${from} ${start ? '<' : ''}${open} ${mermaidText([e.label])} ${body === '-.-' ? '.-' : body}${end ? '>' : ''} ${to}`;
    }
    return `  ${from} ${start ? '<' : ''}${body}${tail} ${to}`;
  }

  styles(): void {
    for (const n of this.out.page.data.nodes) {
      const props = n.colors !== undefined ? styleProps(n.colors) : '';
      if (props !== '') this.lines.push(`  style ${this.id(n.id)} ${props}`);
    }
    for (const c of this.out.page.data.containers ?? []) {
      const props = c.colors !== undefined ? styleProps(c.colors) : '';
      if (props !== '') this.lines.push(`  style ${this.id(c.id)} ${props}`);
    }
  }
}

/** Writes the page `opts.page` names, else the first, as a Mermaid block diagram. */
export function writeBlockDiagram(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'block-beta\n', warnings: [] };
  if (out.page.data.nodes.some((n) => n.at !== undefined)) out.warnings.add('Mermaid holds no positions; the page is laid out again when read.');
  if (out.edges.some((e) => e.endLabels !== undefined)) out.warnings.add('Mermaid block diagrams have no labels at a connector\'s ends; they were dropped.');
  const w = new BlockWriter(out);
  w.lines.push(...titleLines(out.page.name), 'block-beta');
  if (w.grid.columns !== undefined) w.lines.push(`  columns ${w.grid.columns}`);
  w.level(out.nodes, out.clusters, '  ');
  for (const e of out.edges) w.lines.push(w.link(e));
  w.styles();
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
