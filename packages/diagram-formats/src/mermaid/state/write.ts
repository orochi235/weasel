/**
 * One graph page as a Mermaid state diagram: `start` and `end` shapes as each
 * scope's `[*]`, bars as forks and joins, empty diamonds as choices,
 * containers as composite states and pools as composites divided into
 * concurrent regions, and `note` shapes as notes.
 */
import type { DataEdge, DataNode, LayoutDirection } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { edgeStyleIn, graphOut, nodeLines, type Cluster, type GraphOut } from '../../graphWrite';
import { titleLines } from '../common/lines';
import { styleProps } from '../common/styles';
import { mermaidEscaped, mermaidIds } from '../common/text';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TB', up: 'BT', right: 'LR', left: 'RL' };

const isPseudo = (n: DataNode | undefined): boolean => n?.outline === 'start' || n?.outline === 'end';

class StateWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  /** The cluster each node sits in directly. */
  readonly scopeOf = new Map<string, string>();
  readonly pools: ReadonlySet<string>;
  readonly notes: ReadonlySet<string>;

  constructor(readonly out: GraphOut) {
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...out.clusterIds]);
    const visit = (c: Cluster) => {
      for (const id of c.nodes) this.scopeOf.set(id, c.id);
      c.clusters.forEach(visit);
    };
    out.clusters.forEach(visit);
    this.pools = new Set((out.page.data.containers ?? []).filter((c) => c.role === 'pool').map((c) => c.id));
    this.notes = new Set(out.page.data.nodes.filter((n) => n.outline === 'note').map((n) => n.id));
  }

  id(id: string): string {
    return isPseudo(this.out.byId.get(id)) ? '[*]' : this.ids.get(id) ?? id;
  }

  node(node: DataNode, indent: string): void {
    if (isPseudo(node) || this.notes.has(node.id)) return;
    const id = this.id(node.id);
    const lines = nodeLines(node, this.out.warnings, 'Mermaid');
    if (node.outline === 'bar') {
      const outs = this.out.edges.filter((e) => e.from === node.id).length;
      const ins = this.out.edges.filter((e) => e.to === node.id).length;
      this.lines.push(`${indent}state ${id} <<${outs > ins ? 'fork' : 'join'}>>`);
    } else if (node.outline === 'diamond' && lines.length === 0) {
      this.lines.push(`${indent}state ${id} <<choice>>`);
    } else if (lines.length === 0 || (lines.length === 1 && lines[0] === node.id)) {
      this.lines.push(`${indent}${id}`);
    } else {
      this.lines.push(`${indent}state "${mermaidEscaped([lines[0]!])}" as ${id}`, ...lines.slice(1).map((l) => `${indent}${id} : ${mermaidEscaped([l])}`));
    }
    if (node.outline !== undefined && !['roundRect', 'bar', 'diamond'].includes(node.outline as string)) {
      this.out.warnings.add('Mermaid draws every state alike; their outlines were dropped.');
    }
  }

  cluster(c: Cluster, indent: string): void {
    const head = c.label !== undefined && c.label !== c.id ? `state "${mermaidEscaped([c.label])}" as ${this.id(c.id)}` : `state ${this.id(c.id)}`;
    this.lines.push(`${indent}${head} {`);
    if (this.pools.has(c.id)) {
      c.clusters.forEach((lane, i) => {
        if (i > 0) this.lines.push(`${indent}  --`);
        this.scope(lane, `${indent}  `);
      });
    } else {
      this.scope(c, `${indent}  `);
    }
    this.lines.push(`${indent}}`);
  }

  /** A scope's states, its nested composites, and the transitions to and from its `[*]`. */
  scope(c: Cluster, indent: string): void {
    for (const id of c.nodes) this.node(this.out.byId.get(id)!, indent);
    for (const child of c.clusters) this.cluster(child, indent);
    for (const e of this.out.edges) if (this.edgeScope(e) === c.id) this.lines.push(this.transition(e, indent));
  }

  /** Where an edge is written: in the scope of a `[*]` it has, else at the top. Notes' edges are written as notes. */
  edgeScope(e: DataEdge): string | null | undefined {
    if (this.notes.has(e.from)) return undefined;
    const pseudo = [e.from, e.to].find((id) => isPseudo(this.out.byId.get(id)));
    return pseudo === undefined ? null : this.scopeOf.get(pseudo) ?? null;
  }

  transition(e: DataEdge, indent: string): string {
    const own = edgeStyleIn(this.out, e);
    const base = edgeStyleIn(this.out);
    if (own.dash !== undefined || own.markerEnd !== base.markerEnd || own.markerStart !== base.markerStart) {
      this.out.warnings.add('Mermaid draws every transition alike; their dashes and ends were dropped.');
    }
    const label = e.label !== undefined && e.label !== '' ? ` : ${mermaidEscaped([e.label])}` : '';
    return `${indent}${this.id(e.from)} --> ${this.id(e.to)}${label}`;
  }

  noteLines(): void {
    for (const id of this.notes) {
      const target = this.out.edges.find((e) => e.from === id);
      const text = (this.out.byId.get(id)!.lines ?? []).map((l) => mermaidEscaped([l]));
      if (target === undefined) {
        this.out.warnings.add('Mermaid notes sit beside a state; notes beside none were dropped.');
        continue;
      }
      if (text.length === 1) this.lines.push(`  note right of ${this.id(target.to)} : ${text[0]}`);
      else this.lines.push(`  note right of ${this.id(target.to)}`, ...text.map((t) => `    ${t}`), '  end note');
    }
  }

  styles(): void {
    const byProps = new Map<string, string[]>();
    for (const n of this.out.page.data.nodes) {
      const props = n.colors !== undefined && !isPseudo(n) && !this.notes.has(n.id) ? styleProps(n.colors) : '';
      if (props !== '') byProps.set(props, [...(byProps.get(props) ?? []), this.id(n.id)]);
    }
    [...byProps].forEach(([props, ids], i) => this.lines.push(`  classDef s${i + 1} ${props}`, `  class ${ids.join(',')} s${i + 1}`));
  }
}

/** Writes the page `opts.page` names, else the first, as a Mermaid `stateDiagram-v2`. */
export function writeStateDiagram(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid', true);
  if (out === null) return { text: 'stateDiagram-v2\n', warnings: [] };
  if (out.page.data.nodes.some((n) => n.at !== undefined)) out.warnings.add('Mermaid holds no positions; the page is laid out again when read.');
  const w = new StateWriter(out);
  const { page } = out;
  w.lines.push(...titleLines(page.name), 'stateDiagram-v2');
  if (page.direction !== undefined && page.direction !== 'down') w.lines.push(`  direction ${HEADER[page.direction]}`);
  for (const n of out.nodes) w.node(n, '  ');
  for (const c of out.clusters) w.cluster(c, '  ');
  for (const e of out.edges) if (w.edgeScope(e) === null) w.lines.push(w.transition(e, '  '));
  w.noteLines();
  w.styles();
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
