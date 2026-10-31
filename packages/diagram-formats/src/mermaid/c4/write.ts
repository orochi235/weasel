/** One graph page as a Mermaid C4 diagram: shapes as elements by their `<<kind>>` row, containers as boundaries. */
import type { DataEdge, DataNode, EdgeStyle, NodeStyle } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../../document';
import { edgeStyleIn, graphOut, nodeLines, type Cluster, type GraphOut } from '../../graphWrite';
import { mermaidIds } from '../common/text';
import { elementParts, hasTechnology, macroOf } from './kinds';
import { C4_HEADERS } from './parse';
import { BOUNDARY_TYPES, C4_NOTATIONS } from './read';

const BY_TYPE = new Map(Object.entries(BOUNDARY_TYPES).filter(([, t]) => t !== null).map(([macro, t]) => [t!, macro]));
const REL_WAYS: Readonly<Record<string, string>> = { 'n s': 'U', 's n': 'D', 'w e': 'L', 'e w': 'R' };

/** An argument in quotes, its own quotes made single. */
const quoted = (s: string): string => `"${s.replace(/"/g, "'")}"`;

/** Positional arguments, the first `bare` as ids and the rest quoted, trailing empty ones left off. */
function args(list: readonly (string | undefined)[], bare = 1): string {
  const out = list.map((s) => s ?? '');
  while (out.length > bare + 1 && out.at(-1) === '') out.pop();
  return out.map((s, i) => (i < bare ? s : quoted(s))).join(', ');
}

class C4Writer {
  readonly lines: string[] = [];
  readonly ids: Map<string, string>;
  readonly styles: string[] = [];

  constructor(readonly out: GraphOut, readonly deployment: boolean) {
    this.ids = mermaidIds([...out.page.data.nodes.map((n) => n.id), ...out.clusterIds]);
  }

  id(id: string): string {
    return this.ids.get(id) ?? id;
  }

  element(n: DataNode, indent: string): void {
    const { kind, name, technology, description } = elementParts(nodeLines(n, this.out.warnings, 'Mermaid'), n.outline, n.style);
    if (technology !== undefined && !hasTechnology(kind)) this.out.warnings.add('Mermaid C4 people and systems have no technology; it was written into the description.');
    const tech = hasTechnology(kind) ? [technology] : [];
    const desc = !hasTechnology(kind) && technology !== undefined ? `[${technology}] ${description}`.trim() : description;
    this.lines.push(`${indent}${macroOf(kind)}(${args([this.id(n.id), name, ...tech, desc])})`);
    this.colors(n.id, n.colors);
  }

  colors(id: string, colors: Partial<NodeStyle> | undefined): void {
    const set = [
      colors?.fill !== undefined ? `$bgColor=${quoted(colors.fill)}` : null,
      colors?.text !== undefined ? `$fontColor=${quoted(colors.text)}` : null,
      colors?.stroke !== undefined ? `$borderColor=${quoted(colors.stroke)}` : null,
    ].filter((s) => s !== null);
    if (set.length > 0) this.styles.push(`  UpdateElementStyle(${this.id(id)}, ${set.join(', ')})`);
  }

  boundary(c: Cluster, indent: string): void {
    const m = /^(.*?)(?: \[([^\]]*)\])?$/s.exec(c.label ?? c.id)!;
    const [title, type] = [m[1]!, m[2]];
    const fixed = type !== undefined ? BY_TYPE.get(type) : undefined;
    const macro = fixed ?? (this.deployment ? 'Deployment_Node' : 'Boundary');
    this.lines.push(`${indent}${macro}(${args([this.id(c.id), title, ...(fixed === undefined ? [type] : [])])}) {`);
    for (const id of c.nodes) this.element(this.out.byId.get(id)!, `${indent}  `);
    for (const k of c.clusters) this.boundary(k, `${indent}  `);
    this.lines.push(`${indent}}`);
    const own = this.out.page.data.containers?.find((d) => d.id === c.id)?.colors;
    this.colors(c.id, own);
  }

  rel(e: DataEdge): void {
    const style = edgeStyleIn(this.out, e);
    const start = style.markerStart !== null && style.markerStart !== undefined;
    const end = style.markerEnd !== null && style.markerEnd !== undefined;
    const way = REL_WAYS[`${e.fromPort ?? ''} ${e.toPort ?? ''}`];
    const macro = start && !end ? 'Rel_Back' : start ? 'BiRel' : way !== undefined ? `Rel_${way}` : 'Rel';
    if (!start && !end) this.out.warnings.add('Mermaid C4 relationships always have a head; unmarked edges were written with one.');
    if (start && way !== undefined) this.out.warnings.add('Mermaid C4 has no direction for a two-way or backward relationship; its ports were dropped.');
    const m = /^(.*?)(?: \[([^\]]*)\])?$/s.exec(e.label ?? '')!;
    this.lines.push(`  ${macro}(${args([this.id(e.from), this.id(e.to), m[1]!, m[2]], 2)})`);
    this.relColors(e, e.colors);
  }

  relColors(e: DataEdge, colors: Partial<EdgeStyle> | undefined): void {
    const set = [
      colors?.label !== undefined ? `$textColor=${quoted(colors.label)}` : null,
      colors?.stroke !== undefined ? `$lineColor=${quoted(colors.stroke)}` : null,
    ].filter((s) => s !== null);
    if (set.length > 0) this.styles.push(`  UpdateRelStyle(${this.id(e.from)}, ${this.id(e.to)}, ${set.join(', ')})`);
  }
}

/** Writes the page `opts.page` names, else the first, as a Mermaid C4 diagram of the kind its `notation` names. */
export function writeC4(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'Mermaid');
  if (out === null) return { text: 'C4Context\n', warnings: [] };
  if (out.page.data.nodes.some((n) => n.at !== undefined)) out.warnings.add('Mermaid holds no positions; the page is laid out again when read.');
  const header = C4_HEADERS.find((h) => C4_NOTATIONS[h] === out.page.notation) ?? 'C4Context';
  const w = new C4Writer(out, header === 'C4Deployment');
  w.lines.push(header);
  if (out.page.name !== undefined) w.lines.push(`  title ${out.page.name.replace(/\n/g, ' ')}`);
  for (const n of out.nodes) w.element(n, '  ');
  for (const c of out.clusters) w.boundary(c, '  ');
  for (const e of out.edges) w.rel(e);
  w.lines.push(...w.styles);
  return { text: `${w.lines.join('\n')}\n`, warnings: out.warnings.all() };
}
