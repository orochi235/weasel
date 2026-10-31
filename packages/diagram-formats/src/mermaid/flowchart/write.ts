/** One page of a document as a Mermaid flowchart: regions as subgraphs, colors as classes and styles. */
import type { DataEdge, DataNode, LayoutDirection, Outline } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { changed, edgeStyleIn, graphOut, hexColor, nodeLines, nodeStyleIn, type Cluster, type GraphOut } from '../../graphWrite';
import { styleProps } from '../common/styles';
import { mermaidIds, mermaidText } from '../common/text';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TD', up: 'BT', right: 'LR', left: 'RL' };
export const BRACKETS: Readonly<Record<string, readonly [string, string]>> = {
  rect: ['[', ']'], stadium: ['([', '])'], diamond: ['{', '}'], ellipse: ['((', '))'], hexagon: ['{{', '}}'],
  parallelogram: ['[/', '/]'], trapezoid: ['[/', '\\]'], cylinder: ['[(', ')]'], doubleEllipse: ['(((', ')))'], roundRect: ['(', ')'],
};

/** BPMN's figures as the Mermaid shape nearest each: an event's circle, a gateway's diamond without its marker. */
const NEAREST: Readonly<Record<string, string>> = {
  event: 'ellipse', intermediateEvent: 'doubleEllipse', exclusiveGateway: 'diamond', parallelGateway: 'diamond',
  inclusiveGateway: 'diamond', eventGateway: 'diamond', subprocess: 'roundRect',
};

const px = (n: number) => `${n}px`;

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
    const nearest = typeof outline === 'string' ? NEAREST[outline] : undefined;
    if (nearest !== undefined) {
      this.out.warnings.add('Mermaid has no BPMN figures; events were written as circles, gateways as diamonds without their markers, and subprocesses as rounded rectangles.');
    }
    const brackets = typeof outline === 'string' ? BRACKETS[nearest ?? outline] : undefined;
    if (brackets === undefined && typeof outline === 'string') {
      this.out.warnings.add('Mermaid has no bracket shape for some outlines; they were written as rectangles.');
    }
    const [open, close] = brackets ?? BRACKETS.rect!;
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
      if (e.endLabels !== undefined) this.out.warnings.add('Mermaid flowcharts have no labels at a connector\'s ends; they were dropped.');
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
export function writeFlowchart(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
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
