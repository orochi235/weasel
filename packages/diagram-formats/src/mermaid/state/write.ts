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
import { lineOpening, mermaidEscaped, mermaidIds } from '../common/text';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TB', up: 'BT', right: 'LR', left: 'RL' };

const isPseudo = (n: DataNode | undefined): boolean => n?.outline === 'start' || n?.outline === 'end';

class StateWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  /** The cluster each node sits in directly. */
  readonly scopeOf = new Map<string, string>();
  /** The cluster each cluster sits in directly. */
  readonly clusterParent = new Map<string, string>();
  readonly pools: ReadonlySet<string>;
  readonly notes: ReadonlySet<string>;

  constructor(readonly out: GraphOut) {
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...out.clusterIds]);
    const visit = (c: Cluster) => {
      for (const id of c.nodes) this.scopeOf.set(id, c.id);
      for (const child of c.clusters) this.clusterParent.set(child.id, c.id);
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
    } else if (lines.length === 0 || (lines.length === 1 && lines[0] === id)) {
      this.lines.push(`${indent}${id}`);
    } else {
      const described = lines.slice(1).filter((l) => l.trim() !== '');
      if (described.length < lines.length - 1) this.out.warnings.add('Mermaid states describe themselves in lines of text; blank lines past a name were dropped.');
      this.lines.push(`${indent}state "${mermaidEscaped([lines[0]!])}" as ${id}`, ...described.map((l) => `${indent}${id} : ${mermaidEscaped([l])}`));
    }
    if (node.outline === 'diamond' && lines.length > 0) {
      this.out.warnings.add('Mermaid choices hold no text; diamonds with text were written as plain states.');
    } else if (node.outline !== undefined && !['roundRect', 'bar', 'diamond'].includes(node.outline as string)) {
      this.out.warnings.add('Mermaid draws every state alike; their outlines were dropped.');
    }
  }

  cluster(c: Cluster, indent: string): void {
    const head = c.label !== undefined && c.label !== this.id(c.id) ? `state "${mermaidEscaped([c.label])}" as ${this.id(c.id)}` : `state ${this.id(c.id)}`;
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

  /** Where an edge is written: in the scope of a `[*]` it has, else at the top. Notes' edges are written as notes, and
   *  one a scope's `[*]` cannot write is not written. */
  edgeScope(e: DataEdge): string | null | undefined {
    if (this.notes.has(e.from) || this.notes.has(e.to) || this.crossesScope(e)) return undefined;
    return this.pseudoScope(e);
  }

  private pseudoScope(e: DataEdge): string | null {
    const pseudo = [e.from, e.to].find((id) => isPseudo(this.out.byId.get(id)));
    return pseudo === undefined ? null : this.scopeOf.get(pseudo) ?? null;
  }

  /** Whether `e` joins a scope's `[*]` to a state outside that scope, which Mermaid reads as a member of it, or to
   *  another scope's `[*]`. */
  crossesScope(e: DataEdge): boolean {
    const scope = this.pseudoScope(e);
    if (scope === null && ![e.from, e.to].some((id) => isPseudo(this.out.byId.get(id)))) return false;
    return [e.from, e.to].some((id) => {
      const node = this.out.byId.get(id);
      const at = node !== undefined ? this.scopeOf.get(id) ?? null : this.clusterParent.get(id) ?? null;
      if (isPseudo(node)) return at !== scope;
      for (let c: string | null = at; ; c = this.clusterParent.get(c) ?? null) {
        if (c === scope) return false;
        if (c === null) return true;
      }
    });
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

  /** Warns of start and end shapes `[*]` cannot keep apart: a scope reads one start and one end, a start only before
   *  an arrow and an end only after one, and none that no transition names. */
  pseudoWarnings(): void {
    const seen = new Set<string>();
    for (const n of this.out.page.data.nodes) {
      if (!isPseudo(n)) continue;
      const key = `${n.outline}:${this.scopeOf.get(n.id) ?? ''}`;
      const written = this.out.edges.filter((e) => (e.from === n.id || e.to === n.id) && this.edgeScope(e) !== undefined);
      const wrongWay = written.some((e) => (n.outline === 'start' ? e.to : e.from) === n.id);
      if (seen.has(key) || wrongWay || written.length === 0) {
        this.out.warnings.add('Mermaid holds one start and one end per composite, a start only leaving it and an end only arriving; other start and end shapes were merged or dropped.');
      }
      seen.add(key);
    }
  }

  noteLines(): void {
    for (const id of this.notes) {
      const joined = this.out.edges.filter((e) => e.from === id || e.to === id);
      const beside = joined.map((e) => (e.from === id ? e.to : e.from)).find((other) => !isPseudo(this.out.byId.get(other)) && !this.notes.has(other));
      if (joined.length > 1) this.out.warnings.add('Mermaid notes sit beside one state; their other connectors were dropped.');
      if (beside === undefined) {
        this.out.warnings.add('Mermaid notes sit beside a state; notes beside none were dropped.');
        continue;
      }
      const text = nodeLines(this.out.byId.get(id)!, this.out.warnings, 'Mermaid').map((l) => mermaidEscaped([l]));
      if (text.length === 1) this.lines.push(`  note right of ${this.id(beside)} : ${text[0]}`);
      else this.lines.push(`  note right of ${this.id(beside)}`, ...text.map((t) => `    ${lineOpening(t, ['end note'])}`), '  end note');
    }
  }

  styles(): void {
    const byProps = new Map<string, string[]>();
    if (this.out.page.data.nodes.some((n) => isPseudo(n) && n.colors !== undefined)) this.out.warnings.add('Mermaid start and end states hold no colors here; they were dropped.');
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
  if (out.edges.some((e) => w.crossesScope(e))) {
    out.warnings.add('Mermaid joins a composite\'s [*] only to states inside it; transitions joining one to a state outside were dropped.');
  }
  w.pseudoWarnings();
  w.noteLines();
  w.styles();
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
