/** One page of a document as a Mermaid flowchart: regions as subgraphs, colors as classes and styles. */
import type { DataEdge, DataNode, LayoutDirection, NodeStyle, Outline } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../document';
import { changed, edgeStyleIn, graphOut, hexColor, nodeLines, nodeStyleIn, type Cluster, type GraphOut } from '../graphWrite';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TD', up: 'BT', right: 'LR', left: 'RL' };
const RESERVED = new Set(['end', 'subgraph', 'graph', 'flowchart', 'style', 'classdef', 'class', 'click', 'linkstyle', 'direction', 'default', 'call', 'href']);
const BRACKETS: Readonly<Record<string, readonly [string, string]>> = {
  rect: ['[', ']'], stadium: ['([', '])'], diamond: ['{', '}'], ellipse: ['((', '))'], hexagon: ['{{', '}}'],
  parallelogram: ['[/', '/]'], trapezoid: ['[/', '\\]'],
};

const valid = (id: string) => /^[A-Za-z_]\w*$/.test(id) && !RESERVED.has(id.toLowerCase());

/** An id Mermaid reads for each of `ids`: itself where it can be, else a cleaned spelling no other id takes. */
export function mermaidIds(ids: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const taken = new Set(ids.filter(valid));
  for (const id of ids) {
    if (valid(id)) { out.set(id, id); continue; }
    let base = id.replace(/\W+/g, '_').replace(/^_+(?=\w)|(?<=\w)_+$/g, '') || 'n';
    if (/^\d/.test(base)) base = `n${base}`;
    if (!valid(base)) base = `${base}_`;
    let pick = base;
    for (let n = 2; taken.has(pick); n++) pick = `${base}_${n}`;
    taken.add(pick);
    out.set(id, pick);
  }
  return out;
}

/** Text as Mermaid quotes it: the characters it reads as syntax spelled as entities, lines joined by `<br>`. */
export function mermaidText(lines: readonly string[]): string {
  const text = lines.map((l) => l.replace(/#/g, '#35;').replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;')).join('<br>');
  return `"${text === '' ? ' ' : text}"`;
}

const px = (n: number) => `${n}px`;

function styleProps(style: Partial<NodeStyle>): string {
  return [
    style.fill !== undefined ? `fill:${hexColor(style.fill)}` : null,
    style.stroke !== undefined ? `stroke:${hexColor(style.stroke)}` : null,
    style.text !== undefined ? `color:${hexColor(style.text)}` : null,
    style.strokeWidth !== undefined ? `stroke-width:${px(style.strokeWidth)}` : null,
    style.dash !== undefined ? `stroke-dasharray:${style.dash.join(' ')}` : null,
  ].filter((p) => p !== null).join(',');
}

class MermaidWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;

  constructor(readonly out: GraphOut) {
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...out.clusterIds]);
  }

  id(id: string): string {
    return this.ids.get(id) ?? id;
  }

  node(node: DataNode, indent: string): void {
    const outline: Outline = node.outline ?? 'rect';
    const [open, close] = BRACKETS[typeof outline === 'string' ? outline : 'rect']!;
    this.lines.push(`${indent}${this.id(node.id)}${open}${mermaidText(nodeLines(node, this.out.warnings, 'Mermaid'))}${close}`);
  }

  cluster(c: Cluster, indent: string): void {
    this.lines.push(`${indent}subgraph ${this.id(c.id)}${c.label !== undefined ? ` [${mermaidText([c.label])}]` : ''}`);
    for (const id of c.nodes) this.node(this.out.byId.get(id)!, `${indent}  `);
    for (const child of c.clusters) this.cluster(child, `${indent}  `);
    this.lines.push(`${indent}end`);
  }

  link(edge: DataEdge): string {
    const { markerStart, markerEnd, dash, width } = edgeStyleIn(this.out, edge);
    const head = (m: typeof markerEnd) => {
      if (m === null || m === undefined) return '';
      if ((typeof m === 'string' ? m : m.key) === 'circle') return 'o';
      return '>';
    };
    const end = head(markerEnd);
    let start = head(markerStart ?? null);
    if (start !== '' && start !== end) {
      this.out.warnings.add('Mermaid draws a link\'s two heads alike; some ends were changed.');
      start = '';
    }
    const body = dash !== undefined ? '-.-' : (width ?? 0) >= 3 ? '==' : '--';
    const tail = end === '' ? (body === '--' ? '-' : body === '==' ? '=' : '') : end;
    return `${start === '>' ? '<' : start}${body}${tail}`;
  }

  edges(): void {
    for (const e of this.out.edges) {
      if (e.fromPort !== undefined || e.toPort !== undefined) this.out.warnings.add('Mermaid has no ports; connectors\' ports were dropped.');
      const label = e.label !== undefined && e.label !== '' ? `|${mermaidText([e.label])}|` : '';
      this.lines.push(`  ${this.id(e.from)} ${this.link(e)}${label} ${this.id(e.to)}`);
    }
  }

  styles(): void {
    const { out, lines } = this;
    const base = nodeStyleIn(out);
    lines.push(`  classDef default ${styleProps(base)}`);
    const byProps = new Map<string, string[]>();
    for (const n of out.page.data.nodes) {
      const props = styleProps(changed(nodeStyleIn(out, n), base));
      if (props !== '') byProps.set(props, [...(byProps.get(props) ?? []), this.id(n.id)]);
    }
    [...byProps].forEach(([props, ids], i) => lines.push(`  classDef s${i + 1} ${props}`, `  class ${ids.join(',')} s${i + 1}`));
    const visit = (c: Cluster) => {
      const props = c.style !== undefined ? styleProps(c.style) : '';
      if (props !== '') lines.push(`  style ${this.id(c.id)} ${props}`);
      c.clusters.forEach(visit);
    };
    out.clusters.forEach(visit);
    if (out.edges.length === 0) return;
    const edge = edgeStyleIn(out);
    lines.push(`  linkStyle default stroke:${hexColor(edge.stroke)},color:${hexColor(edge.label)}`);
    out.edges.forEach((e, i) => {
      const own = changed(edgeStyleIn(out, e), edge);
      const props = [
        own.stroke !== undefined ? `stroke:${hexColor(own.stroke)}` : null,
        own.label !== undefined ? `color:${hexColor(own.label)}` : null,
        own.width !== undefined ? `stroke-width:${px(own.width)}` : null,
      ].filter((p) => p !== null);
      if (props.length > 0) lines.push(`  linkStyle ${i} ${props.join(',')}`);
    });
  }
}

/** Writes the page `opts.page` names, else the first, as a Mermaid flowchart. */
export function writeMermaid(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'flowchart TD\n', warnings: [] };
  if (out.page.data.nodes.some((n) => n.at !== undefined)) out.warnings.add('Mermaid holds no positions; the page is laid out again when read.');
  const w = new MermaidWriter(out);
  const { page } = out;
  if (page.name !== undefined) w.lines.push('---', `title: ${JSON.stringify(page.name)}`, '---');
  w.lines.push(`flowchart ${HEADER[page.direction ?? 'down']}`);
  for (const n of out.nodes) w.node(n, '  ');
  for (const c of out.clusters) w.cluster(c, '  ');
  w.edges();
  w.styles();
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
