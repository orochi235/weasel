/**
 * What the Mermaid and Graphviz DOT writers share: the page they write, its
 * regions and groups as one tree of clusters, each item's drawn style, and
 * the warnings for what neither format holds.
 */
import {
  dataEdgeStyle, dataNodeStyle, dataRegionStyle, diagramThemeFrom, type DataEdge, type DataNode, type DiagramTheme,
  type EdgeStyle, type NodeStyle,
} from '@weasel-js/diagram';
import { writtenPage, type DiagramDocument, type DocumentPage, type WriteOptions } from './document';
import { Warnings, hex2 } from './graphRead';

/** A container, pool, lane, or group, as the one kind of box a graph format has. */
export interface Cluster {
  id: string;
  label?: string;
  /** Its drawn colors; `fill` unset for one that draws none. Unset for a group. */
  style?: Partial<NodeStyle>;
  nodes: string[];
  clusters: Cluster[];
}

/** One page as a graph format writes it. */
export interface GraphOut {
  page: DocumentPage;
  theme: DiagramTheme;
  /** Nodes and clusters at the top level, in order. */
  nodes: DataNode[];
  clusters: Cluster[];
  /** Every node by id, and every cluster's id. */
  byId: ReadonlyMap<string, DataNode>;
  clusterIds: ReadonlySet<string>;
  edges: DataEdge[];
  warnings: Warnings;
}

/** A node's text, a line per text row. */
export function nodeLines(node: DataNode, warnings: Warnings, format: string): string[] {
  if (node.rows === undefined) return [...(node.lines ?? [])];
  const lines: string[] = [];
  for (const row of node.rows) {
    if (row.kind === 'label') lines.push(row.text);
    else if (row.kind === 'field') lines.push(`${row.label}: ${row.value}`);
    else warnings.add(`${format} holds only text in a shape; its port rows and slots were dropped.`);
  }
  return lines;
}

function clusterTree(page: DocumentPage, theme: DiagramTheme, warnings: Warnings, format: string) {
  const parent = new Map<string, string>();
  const claim = (member: string, owner: string) => { if (!parent.has(member) && member !== owner) parent.set(member, owner); };
  const all: Cluster[] = [];
  for (const c of page.data.containers ?? []) {
    all.push({ id: c.id, ...(c.label !== undefined ? { label: c.label } : {}), style: dataRegionStyle(c, theme), nodes: [], clusters: [] });
    for (const m of c.members ?? []) claim(m, c.id);
    if (c.role === 'pool') warnings.add(`${format} has no pools or lanes; they were written as nested ${format === 'DOT' ? 'clusters' : 'subgraphs'}.`);
    (c.lanes ?? []).forEach((lane, i) => {
      const { fill: _fill, ...style } = dataRegionStyle({ role: 'lane', ...(lane.colors ? { colors: lane.colors } : {}) }, theme, i);
      all.push({ id: lane.id, ...(lane.label !== undefined ? { label: lane.label } : {}), style, nodes: [], clusters: [] });
      claim(lane.id, c.id);
      for (const m of lane.members ?? []) claim(m, lane.id);
    });
  }
  for (const g of page.data.groups ?? []) {
    warnings.add(`${format} has no groups; they were written as ${format === 'DOT' ? 'clusters' : 'subgraphs'}, which read back as containers.`);
    all.push({ id: g.id, ...(g.label !== undefined ? { label: g.label } : {}), nodes: [], clusters: [] });
    for (const m of g.members) claim(m, g.id);
  }
  const byId = new Map(all.map((c) => [c.id, c]));
  const roots: Cluster[] = [];
  for (const c of all) {
    const owner = byId.get(parent.get(c.id) ?? '');
    (owner !== undefined ? owner.clusters : roots).push(c);
  }
  const nodes: DataNode[] = [];
  for (const n of page.data.nodes) {
    const owner = byId.get(parent.get(n.id) ?? '');
    if (owner !== undefined) owner.nodes.push(n.id);
    else nodes.push(n);
  }
  return { nodes, clusters: roots, clusterIds: new Set(byId.keys()) };
}

/** The page `opts` names, ready to write, with the warnings every graph format shares. `null` for a document with no pages. */
export function graphOut(doc: DiagramDocument, opts: WriteOptions | undefined, format: string): GraphOut | null {
  const page = writtenPage(doc, opts);
  if (page === null) return null;
  const warnings = new Warnings();
  const theme = diagramThemeFrom(doc.theme);
  const byId = new Map(page.data.nodes.map((n) => [n.id, n]));
  const tree = clusterTree(page, theme, warnings, format);
  if ((doc.crossPageEdges ?? []).some((e) => byId.has(e.from) || byId.has(e.to))) {
    warnings.add(`${format} holds one page; connectors to other pages were dropped.`);
  }
  for (const n of page.data.nodes) {
    if (n.outline !== undefined && typeof n.outline !== 'string') warnings.add(`${format} has no drawn outlines; those shapes were written as rectangles.`);
    if (n.marks !== undefined && n.marks.length > 0) warnings.add(`${format} has no marks; the marks drawn over shapes were dropped.`);
  }
  if (page.data.edges.some((e) => e.waypoints !== undefined && e.waypoints.length > 0)) {
    warnings.add(`${format} holds no routes; connectors' bends were dropped.`);
  }
  return { page, theme, ...tree, byId, edges: [...page.data.edges], warnings };
}

/** A CSS color in a spelling every graph format reads: `rgb()` and `rgba()` as hex, short hex long. Names pass through. */
export function hexColor(css: string): string {
  const short = /^#([\da-f])([\da-f])([\da-f])([\da-f])?$/i.exec(css);
  if (short !== null) return `#${short.slice(1).filter(Boolean).map((d) => d! + d!).join('')}`;
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i.exec(css);
  if (rgb === null) return css;
  const alpha = rgb[4] === undefined ? '' : hex2(Number(rgb[4]) / (rgb[5] === '%' ? 100 : 1));
  return `#${hex2(Number(rgb[1]) / 255)}${hex2(Number(rgb[2]) / 255)}${hex2(Number(rgb[3]) / 255)}${alpha}`;
}

/** `style`'s fields that differ from `base`. */
export function changed<T extends object>(style: T, base: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(style) as (keyof T)[]) {
    if (JSON.stringify(style[key]) !== JSON.stringify(base[key])) out[key] = style[key];
  }
  return out;
}

/** A node's drawn style, and the one every node gets when nothing says otherwise. */
export const nodeStyleIn = (out: GraphOut, node?: DataNode): NodeStyle => dataNodeStyle(node ?? {}, out.theme);

/** An edge's drawn style, its arrowhead filled in, and its label color. */
export function edgeStyleIn(out: GraphOut, edge?: DataEdge): Required<Pick<EdgeStyle, 'stroke' | 'label'>> & EdgeStyle {
  const style = dataEdgeStyle(edge ?? {}, out.theme);
  return { ...style, label: style.label ?? style.stroke, markerEnd: style.markerEnd === undefined ? 'arrow' : style.markerEnd };
}
