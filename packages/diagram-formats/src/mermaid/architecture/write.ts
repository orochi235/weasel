/** One graph page as a Mermaid architecture diagram: containers as groups, shapes as services, dots as junctions. */
import type { DataEdge, DataNode } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { edgeStyleIn, graphOut, nodeLines, type Cluster, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { mermaidIds } from '../common/text';
import type { ArchSide } from './parse';
import { ICON_OUTLINES, SIDE_PORTS } from './read';

const OUTLINE_ICONS = new Map(Object.entries(ICON_OUTLINES).map(([icon, outline]) => [outline, icon]));
const PORT_SIDES = new Map(Object.entries(SIDE_PORTS).map(([side, port]) => [port, side as ArchSide]));

/** A title as Mermaid's brackets hold it: one line, no closing bracket. */
const title = (lines: readonly string[]): string => lines.join(' ').replace(/\]/g, ')');

class ArchWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  /** Each cluster's id and the cluster it is in. */
  readonly parent = new Map<string, string>();
  readonly clusters = new Map<string, Cluster>();

  constructor(readonly out: GraphOut) {
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...out.clusterIds]);
    const visit = (c: Cluster, parent: string | undefined) => {
      this.clusters.set(c.id, c);
      if (parent !== undefined) this.parent.set(c.id, parent);
      for (const n of c.nodes) this.parent.set(n, c.id);
      for (const k of c.clusters) visit(k, c.id);
    };
    for (const c of out.clusters) visit(c, undefined);
  }

  id(id: string): string {
    return this.ids.get(id) ?? id;
  }

  in(id: string): string {
    const p = this.parent.get(id);
    return p === undefined ? '' : ` in ${this.id(p)}`;
  }

  group(c: Cluster): void {
    this.lines.push(`  group ${this.id(c.id)}${c.label !== undefined ? `[${title([c.label])}]` : ''}${this.in(c.id)}`);
    for (const k of c.clusters) this.group(k);
  }

  node(n: DataNode): void {
    const text = nodeLines(n, this.out.warnings, 'Mermaid');
    if (n.outline === 'start' && text.every((t) => t === '')) {
      this.lines.push(`  junction ${this.id(n.id)}${this.in(n.id)}`);
      return;
    }
    const icon = typeof n.outline === 'string' ? OUTLINE_ICONS.get(n.outline) : undefined;
    if (icon === undefined && n.outline !== undefined && n.outline !== 'roundRect') {
      this.out.warnings.add('Mermaid architecture services wear only its built-in icons; other outlines were dropped.');
    }
    const named = text.length === 0 || (text.length === 1 && text[0] === n.id) ? '' : `[${title(text)}]`;
    this.lines.push(`  service ${this.id(n.id)}${icon !== undefined ? `(${icon})` : ''}${named}${this.in(n.id)}`);
  }

  /** An edge's end: a service and its side, or a service in a group and `{group}`. Null for an empty group. */
  end(id: string, port: string | undefined, fallback: ArchSide): string | null {
    const c = this.clusters.get(id);
    const side = PORT_SIDES.get(port ?? '') ?? fallback;
    if (c === undefined) return `${this.id(id)}:${side}`;
    const inside = this.firstNode(c);
    return inside === undefined ? null : `${this.id(inside)}{group}:${side}`;
  }

  firstNode(c: Cluster): string | undefined {
    return c.nodes[0] ?? c.clusters.map((k) => this.firstNode(k)).find((n) => n !== undefined);
  }

  edge(e: DataEdge): void {
    const style = edgeStyleIn(this.out, e);
    const from = this.end(e.from, e.fromPort ?? e.routedPorts?.from, 'R');
    const to = this.end(e.to, e.toPort ?? e.routedPorts?.to, 'L');
    if (from === null || to === null) {
      this.out.warnings.add('Mermaid architecture edges meet a group through a service in it; edges to empty groups were dropped.');
      return;
    }
    if (e.label !== undefined && e.label !== '') this.out.warnings.add('Mermaid architecture edges have no labels; they were dropped.');
    const [name, side] = to.split(/:(?=[LRTB]$)/) as [string, string];
    const start = style.markerStart !== null && style.markerStart !== undefined ? '<' : '';
    const end = style.markerEnd !== null && style.markerEnd !== undefined ? '>' : '';
    this.lines.push(`  ${from} ${start}--${end} ${side}:${name}`);
  }
}

/** Writes the page `opts.page` names, else the first, as a Mermaid architecture diagram. */
export function writeArchitecture(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'architecture-beta\n', warnings: [] };
  if (out.page.data.nodes.some((n) => n.at !== undefined)) out.warnings.add('Mermaid holds no positions; the page is laid out again when read.');
  const w = new ArchWriter(out);
  w.lines.push(...titleLines(out.page.name), 'architecture-beta');
  for (const c of out.clusters) w.group(c);
  for (const n of out.page.data.nodes) w.node(n);
  for (const e of out.edges) w.edge(e);
  if (out.page.data.nodes.some((n) => n.colors !== undefined) || out.edges.some((e) => e.colors?.stroke !== undefined)) {
    out.warnings.add('Mermaid architecture diagrams have no styles; colors were dropped.');
  }
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
