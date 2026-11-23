/** One graph page as a Mermaid class diagram: boxes as classes, containers as namespaces, `note` shapes as notes. */
import type { MarkerRef } from '@weasel-js/core';
import type { DataEdge, DataNode, LayoutDirection, Row } from '@weasel-js/diagram';
import { getOwn } from '@weasel-js/registry';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { edgeStyleIn, graphOut, nodeLines, type Cluster, type GraphOut } from '../../graphWrite';
import { readsAsStatement, titleLines } from '../common/lines';
import { dropEdgeColors, dropPorts, styleProps } from '../common/styles';
import { mermaidIds, oneLine, spelledBreaks } from '../common/text';

const HEADER: Readonly<Record<LayoutDirection, string>> = { down: 'TB', up: 'BT', right: 'LR', left: 'RL' };

/** Text as a class diagram's strings hold it: a `#`, a double quote, and line ends spelled as the entities its reader reads. */
const spelled = (text: string): string => spelledBreaks(text.replace(/#/g, '#35;').replace(/"/g, '#quot;'));

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

/** Whether every `<` in `text` closes, in order, and nothing else does, and every tilde written for one reads back as
 *  it: the reader opens at a `~` before an ASCII word character and closes at any other. */
function balanced(text: string): boolean {
  let depth = 0;
  for (const c of text) {
    if (c === '<') depth += 1;
    else if (c === '>' && --depth < 0) return false;
  }
  return depth === 0 && !/[~[{"]|<(?!\w)|>(?=\w)/.test(text);
}

/** A body line the reader takes as an annotation rather than a member. */
const ANNOTATION = /^<<\s*.+?\s*>>$/s;

/** The ids the reader takes for a class and a namespace, less any holding `--`, which reads as a line. */
const CLASS_ID = /^(?!.*--)[\w-]+$/;
const NAMESPACE_ID = /^(?!.*--)[\w.-]+$/;

const HEADS: Readonly<Record<string, readonly [string, string]>> = {
  'triangle-hollow': ['<|', '|>'], diamond: ['*', '*'], 'diamond-hollow': ['o', 'o'], arrow: ['<', '>'], 'arrow-open': ['<', '>'],
};

class ClassWriter {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  readonly notes = new Map<string, DataEdge | null>();

  constructor(readonly out: GraphOut) {
    const classes = mermaidIds(out.page.data.nodes.map((n) => n.id), { id: CLASS_ID });
    this.ids = new Map([...classes, ...mermaidIds([...out.clusterIds], { id: NAMESPACE_ID, reserved: [...classes.values()] })]);
    for (const n of out.page.data.nodes) {
      if (n.outline !== 'note') continue;
      const own = out.edges.filter((e) => e.from === n.id || e.to === n.id);
      const to = own.length === 1 && own[0]!.from === n.id ? out.byId.get(own[0]!.to) : undefined;
      const target = to !== undefined && to.outline !== 'note' ? own[0]! : null;
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
    const generic = /^([^<>]*)<(.*)>$/.exec(name);
    const head = name === id ? id
      : generic !== null && generic[1] === id && balanced(generic[2]!) ? `${id}~${generic[2]!.replace(/[<>]/g, '~')}~`
        : `${id}["${spelled(name)}"]`;
    const members = [...attributes, ...methods].map((m) => oneLine(m, 'class diagram member', (w) => this.out.warnings.add(w)).trim());
    const kept = members.filter((m) => m !== '}' && readsAsStatement(m) && !ANNOTATION.test(m));
    if (kept.length < members.length) this.out.warnings.add('Mermaid class members are lines of text; blank ones, and ones it reads as comments, a closing brace, or an annotation, were dropped.');
    const body = [...annotations.map((a) => `<<${a}>>`), ...kept];
    if (body.length === 0) {
      this.lines.push(`${indent}class ${head}`);
      return;
    }
    this.lines.push(`${indent}class ${head} {`, ...body.map((b) => `${indent}  ${b}`), `${indent}}`);
    if (attributes.some((a) => a.includes('('))) this.out.warnings.add('Mermaid reads a member with parentheses as a method; such attributes read back as methods.');
    if (methods.some((m) => !m.includes('('))) this.out.warnings.add('Mermaid reads a member without parentheses as an attribute; such methods read back as attributes.');
  }

  cluster(c: Cluster, indent: string): void {
    this.lines.push(`${indent}namespace ${this.id(c.id)} {`);
    for (const id of c.nodes) this.node(this.out.byId.get(id)!, `${indent}  `);
    if (c.nodes.some((id) => this.notes.has(id))) this.out.warnings.add('Mermaid class notes stand outside namespaces; notes in one were written at the top level.');
    for (const child of c.clusters) this.cluster(child, `${indent}  `);
    this.lines.push(`${indent}}`);
    if (c.label !== undefined && c.label !== this.id(c.id)) this.out.warnings.add('Mermaid names a namespace by its id; container titles were dropped.');
  }

  head(marker: MarkerRef | null | undefined, side: 0 | 1): string {
    if (marker === null || marker === undefined) return '';
    const known = getOwn(HEADS, typeof marker === 'string' ? marker : marker.key);
    if (known === undefined) this.out.warnings.add('Mermaid class diagrams have only UML ends; others were written as arrows.');
    return (known ?? HEADS.arrow!)[side];
  }

  relation(e: DataEdge): string {
    const style = edgeStyleIn(this.out, e);
    const card = (text: string | undefined) => (text !== undefined ? ` "${spelled(text)}"` : '');
    const line = style.dash !== undefined ? '..' : '--';
    const drawn = line === '..' ? 'arrow-open' : 'arrow';
    if ([style.markerStart, style.markerEnd].some((m) => (m === 'arrow' || m === 'arrow-open') && m !== drawn)) {
      this.out.warnings.add('Mermaid class relations draw an open arrow on a dashed line and a filled one on a solid line; other arrows were written as their line\'s.');
    }
    const label = e.label !== undefined && e.label !== '' ? ` : ${spelled(e.label)}` : '';
    const arrow = `${this.head(style.markerStart, 0)}${line}${this.head(style.markerEnd, 1)}`;
    return `  ${this.id(e.from)}${card(e.endLabels?.from)} ${arrow}${card(e.endLabels?.to)} ${this.id(e.to)}${label}`;
  }

  noteLines(): void {
    for (const [id, target] of this.notes) {
      const text = nodeLines(this.out.byId.get(id)!, this.out.warnings, 'Mermaid').map((l) => spelled(l).replace(/\\/g, '#92;')).join('\\n');
      this.lines.push(target === null ? `  note "${text}"` : `  note for ${this.id(target.to)} "${text}"`);
    }
  }

  styles(): void {
    for (const n of this.out.page.data.nodes) {
      const props = n.colors !== undefined && !this.notes.has(n.id) ? styleProps(n.colors) : '';
      if (props !== '') this.lines.push(`  style ${this.id(n.id)} ${props}`);
    }
    const unstyled = [...this.out.page.data.nodes.filter((n) => this.notes.has(n.id)), ...(this.out.page.data.containers ?? [])];
    if (unstyled.some((d) => d.colors !== undefined && styleProps(d.colors) !== '')) {
      this.out.warnings.add('Mermaid class diagrams style only classes; note and namespace colors were dropped.');
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
    if (!out.byId.has(e.from) || !out.byId.has(e.to)) {
      out.warnings.add('Mermaid class relations join classes; connectors to namespaces were dropped.');
      continue;
    }
    dropPorts(e, (m) => out.warnings.add(m));
    w.lines.push(w.relation(e));
  }
  dropEdgeColors(out.edges, 'class diagram', (m) => out.warnings.add(m));
  w.noteLines();
  w.styles();
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
