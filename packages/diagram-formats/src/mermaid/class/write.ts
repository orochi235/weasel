/** One graph page as a Mermaid class diagram: boxes as classes, containers as namespaces, `note` shapes as notes. */
import type { MarkerRef } from '@weasel-js/core';
import type { DataEdge, DataNode, LayoutDirection, Row } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { edgeStyleIn, graphOut, type Cluster, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { styleProps } from '../common/styles';
import { mermaidIds } from '../common/text';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TB', up: 'BT', right: 'LR', left: 'RL' };

/** A class box's parts, from its rows: what is above the first divider, then between, then below the second. */
export function classParts(node: DataNode): { annotations: string[]; name: string; attributes: string[]; methods: string[] } {
  const rows: readonly Row[] = node.rows ?? (node.lines ?? []).map((text) => ({ kind: 'label', text }));
  const sections: string[][] = [[]];
  for (const row of rows) {
    if (row.kind === 'divider') sections.push([]);
    else if (row.kind === 'label') sections.at(-1)!.push(row.text);
    else if (row.kind === 'field') sections.at(-1)!.push(`${row.label} ${row.value}`);
  }
  const [head = [], ...rest] = sections;
  const annotations = head.filter((t) => /^<<.*>>$/.test(t)).map((t) => t.slice(2, -2));
  const names = head.filter((t) => !/^<<.*>>$/.test(t));
  const members = rest.flat();
  const attributes = rest.length > 1 ? rest[0]! : [...names.slice(1), ...members].filter((m) => !m.includes('('));
  const methods = rest.length > 1 ? rest.slice(1).flat() : [...names.slice(1), ...members].filter((m) => m.includes('('));
  return { annotations, name: names[0] ?? node.id, attributes, methods };
}

const HEADS: Readonly<Record<string, readonly [string, string]>> = {
  'triangle-hollow': ['<|', '|>'], diamond: ['*', '*'], 'diamond-hollow': ['o', 'o'], arrow: ['<', '>'], 'arrow-open': ['<', '>'],
};

class ClassWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  readonly notes = new Map<string, DataEdge | null>();

  constructor(readonly out: GraphOut) {
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...out.clusterIds]);
    for (const n of out.page.data.nodes) {
      if (n.outline !== 'note') continue;
      const own = out.edges.filter((e) => e.from === n.id || e.to === n.id);
      const target = own.length === 1 && own[0]!.from === n.id ? own[0]! : null;
      if (own.length > (target !== null ? 1 : 0)) out.warnings.add('Mermaid notes join one class; their other connectors were dropped.');
      this.notes.set(n.id, target);
    }
  }

  id(id: string): string {
    return this.ids.get(id) ?? id;
  }

  node(node: DataNode, indent: string): void {
    if (this.notes.has(node.id)) return;
    const { annotations, name, attributes, methods } = classParts(node);
    const id = this.id(node.id);
    const generic = /^(.*)<([^<>]*)>$/.exec(name);
    const head = name === node.id ? id
      : generic !== null && generic[1] === node.id ? `${id}~${generic[2]}~`
        : `${id}["${name.replace(/"/g, '#quot;')}"]`;
    const body = [...annotations.map((a) => `<<${a}>>`), ...attributes, ...methods];
    if (body.length === 0) {
      this.lines.push(`${indent}class ${head}`);
      return;
    }
    this.lines.push(`${indent}class ${head} {`, ...body.map((b) => `${indent}  ${b}`), `${indent}}`);
    if (attributes.some((a) => a.includes('('))) this.out.warnings.add('Mermaid reads a member with parentheses as a method; such attributes read back as methods.');
  }

  cluster(c: Cluster, indent: string): void {
    this.lines.push(`${indent}namespace ${this.id(c.id)} {`);
    for (const id of c.nodes) this.node(this.out.byId.get(id)!, `${indent}  `);
    for (const child of c.clusters) this.cluster(child, `${indent}  `);
    this.lines.push(`${indent}}`);
    if (c.label !== undefined && c.label !== c.id) this.out.warnings.add('Mermaid names a namespace by its id; container titles were dropped.');
  }

  head(marker: MarkerRef | null | undefined, side: 0 | 1): string {
    if (marker === null || marker === undefined) return '';
    const known = HEADS[typeof marker === 'string' ? marker : marker.key];
    if (known === undefined) this.out.warnings.add('Mermaid class diagrams have only UML ends; others were written as arrows.');
    return (known ?? HEADS.arrow!)[side];
  }

  relation(e: DataEdge): string {
    const style = edgeStyleIn(this.out, e);
    const card = (text: string | undefined) => (text !== undefined ? ` "${text.replace(/"/g, '#quot;')}"` : '');
    const line = style.dash !== undefined ? '..' : '--';
    const label = e.label !== undefined && e.label !== '' ? ` : ${e.label}` : '';
    const arrow = `${this.head(style.markerStart, 0)}${line}${this.head(style.markerEnd, 1)}`;
    return `  ${this.id(e.from)}${card(e.endLabels?.from)} ${arrow}${card(e.endLabels?.to)} ${this.id(e.to)}${label}`;
  }

  noteLines(): void {
    for (const [id, target] of this.notes) {
      const text = (this.out.byId.get(id)!.lines ?? []).join('\\n').replace(/"/g, '#quot;');
      this.lines.push(target === null ? `  note "${text}"` : `  note for ${this.id(target.to)} "${text}"`);
    }
  }

  styles(): void {
    for (const n of this.out.page.data.nodes) {
      const props = n.colors !== undefined && !this.notes.has(n.id) ? styleProps(n.colors) : '';
      if (props !== '') this.lines.push(`  style ${this.id(n.id)} ${props}`);
    }
  }
}

/** Writes the page `opts.page` names, else the first, as a Mermaid class diagram. */
export function writeClassDiagram(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'classDiagram\n', warnings: [] };
  if (out.page.data.nodes.some((n) => n.at !== undefined)) out.warnings.add('Mermaid holds no positions; the page is laid out again when read.');
  const w = new ClassWriter(out);
  const { page } = out;
  w.lines.push(...titleLines(page.name), 'classDiagram');
  if (page.direction !== undefined && page.direction !== 'down') w.lines.push(`  direction ${HEADER[page.direction]}`);
  for (const n of out.nodes) w.node(n, '  ');
  for (const c of out.clusters) w.cluster(c, '  ');
  const noteEdges = new Set([...w.notes.values()].filter((e) => e !== null));
  for (const e of out.edges) {
    if (noteEdges.has(e) || w.notes.has(e.from) || w.notes.has(e.to)) continue;
    w.lines.push(w.relation(e));
  }
  w.noteLines();
  w.styles();
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
