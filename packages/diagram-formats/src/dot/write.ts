/** One page of a document as a Graphviz DOT digraph: regions as clusters, and places as `pos` when every node has one. */
import type { DataEdge, DataNode, LayoutDirection } from '@weasel-js/diagram';
import type { DiagramDocument, ExportResult, WriteOptions } from '../document';
import { changed, edgeStyleIn, graphOut, hexColor, nodeLines, nodeStyleIn, type Cluster, type GraphOut } from '../graphWrite';
import { arrowName, quoteLabel, shapeOf } from './values';

const RANKDIR: Readonly<Record<LayoutDirection, string | null>> = { down: null, up: 'BT', right: 'LR', left: 'RL' };
const KEYWORDS = new Set(['node', 'edge', 'graph', 'digraph', 'subgraph', 'strict']);
const COMPASS = new Set(['n', 'e', 's', 'w']);
const POINTS_PER_INCH = 72;

/** `id` as DOT writes it: bare when it can be, else quoted. */
export function dotId(id: string): string {
  const bare = (/^[A-Za-z_\u0080-￿][\w\u0080-￿]*$/.test(id) && !KEYWORDS.has(id.toLowerCase()))
    || /^-?(?:\.\d+|\d+(?:\.\d*)?)$/.test(id);
  return bare ? id : `"${id.replace(/"/g, '\\"')}"`;
}

const attrList = (attrs: readonly (string | null)[]) => {
  const set = attrs.filter((a): a is string => a !== null);
  return set.length > 0 ? ` [${set.join(', ')}]` : '';
};
const color = (key: string, value: string | undefined) => (value === undefined ? null : `${key}="${hexColor(value)}"`);
const num = (n: number) => String(Math.round(n * 10000) / 10000);

function nodeAttrs(out: GraphOut, node: DataNode, placed: boolean): string {
  const { shape, rounded } = shapeOf(node.outline);
  const own = changed(nodeStyleIn(out, node), nodeStyleIn(out));
  const styles = [rounded ? 'rounded' : null, 'filled', own.dash !== undefined ? 'dashed' : null].filter((s) => s !== null);
  const page = out.page.height;
  return attrList([
    `label=${quoteLabel(nodeLines(node, out.warnings, 'DOT'))}`,
    shape !== 'box' ? `shape=${shape}` : null,
    styles.length > 1 ? `style="${styles.join(',')}"` : null,
    color('fillcolor', own.fill), color('color', own.stroke), color('fontcolor', own.text),
    own.strokeWidth !== undefined ? `penwidth=${own.strokeWidth}` : null,
    placed ? `pos="${num(node.at!.x + node.width! / 2)},${num(page - node.at!.y - node.height! / 2)}"` : null,
    placed ? `width=${num(node.width! / POINTS_PER_INCH)}, height=${num(node.height! / POINTS_PER_INCH)}` : null,
  ]);
}

function writeCluster(out: GraphOut, c: Cluster, placed: boolean, indent: string, lines: string[]): void {
  lines.push(`${indent}subgraph ${dotId(`cluster_${c.id}`)} {`);
  const inner = `${indent}  `;
  if (c.label !== undefined) lines.push(`${inner}label=${quoteLabel([c.label])};`);
  if (c.style !== undefined) {
    if (c.style.fill !== undefined) lines.push(`${inner}style=filled;`, `${inner}${color('fillcolor', c.style.fill)};`);
    for (const [key, value] of [['color', c.style.stroke], ['fontcolor', c.style.text]] as const) {
      if (value !== undefined) lines.push(`${inner}${color(key, value)};`);
    }
  }
  for (const id of c.nodes) lines.push(`${inner}${dotId(id)}${nodeAttrs(out, out.byId.get(id)!, placed)};`);
  for (const child of c.clusters) writeCluster(out, child, placed, inner, lines);
  lines.push(`${indent}}`);
}

function endOf(out: GraphOut, id: string, port: string | undefined): string {
  if (port === undefined) return dotId(id);
  if (COMPASS.has(port)) return `${dotId(id)}:${port}`;
  out.warnings.add('DOT has only compass ports; connectors\' other ports were dropped.');
  return dotId(id);
}

function markerAttrs(out: GraphOut, edge: DataEdge): (string | null)[] {
  const { markerStart, markerEnd } = edgeStyleIn(out, edge);
  const name = (m: typeof markerEnd) => {
    if (m === null || m === undefined) return null;
    const n = arrowName(m);
    if (n === undefined) out.warnings.add('DOT has no arrowhead for some markers; they were written as arrows.');
    return n ?? 'normal';
  };
  const head = name(markerEnd);
  const tail = name(markerStart ?? null);
  const dir = head !== null && tail !== null ? 'both' : head !== null ? null : tail !== null ? 'back' : 'none';
  return [
    dir !== null ? `dir=${dir}` : null,
    head !== null && head !== 'normal' ? `arrowhead=${head}` : null,
    tail !== null && tail !== 'normal' ? `arrowtail=${tail}` : null,
  ];
}

function edgeLine(out: GraphOut, edge: DataEdge): string | null {
  if (!out.byId.has(edge.from) || !out.byId.has(edge.to)) {
    if (out.clusterIds.has(edge.from) || out.clusterIds.has(edge.to)) {
      out.warnings.add('DOT joins nodes only; connectors to containers and groups were dropped.');
    }
    return null;
  }
  const own = changed(edgeStyleIn(out, edge), edgeStyleIn(out));
  return `${endOf(out, edge.from, edge.fromPort)} -> ${endOf(out, edge.to, edge.toPort)}${attrList([
    edge.label !== undefined ? `label=${quoteLabel([edge.label])}` : null,
    color('color', own.stroke), color('fontcolor', own.label),
    own.width !== undefined ? `penwidth=${own.width}` : null,
    own.dash !== undefined ? 'style=dashed' : null,
    ...markerAttrs(out, edge),
  ])};`;
}

/** Writes the page `opts.page` names, else the first, as a DOT digraph. */
export function writeDot(doc: DiagramDocument, opts?: WriteOptions): ExportResult {
  const out = graphOut(doc, opts, 'DOT');
  if (out === null) return { text: 'digraph {\n}\n', warnings: [] };
  const { page } = out;
  const placed = page.data.nodes.length > 0
    && page.data.nodes.every((n) => n.at !== undefined && n.width !== undefined && n.height !== undefined);
  const node = nodeStyleIn(out);
  const edge = edgeStyleIn(out);
  const rankdir = page.direction === undefined ? null : RANKDIR[page.direction];
  const lines = [
    `digraph ${page.name !== undefined ? dotId(page.name) : ''}${page.name !== undefined ? ' ' : ''}{`,
    ...(rankdir !== null ? [`  rankdir=${rankdir};`] : []),
    ...(placed ? [`  bb="0,0,${num(page.width)},${num(page.height)}";`] : []),
    `  node${attrList(['shape=box', 'style=filled', color('fillcolor', node.fill), color('color', node.stroke), color('fontcolor', node.text)])};`,
    `  edge${attrList([color('color', edge.stroke), color('fontcolor', edge.label)])};`,
  ];
  for (const n of out.nodes) lines.push(`  ${dotId(n.id)}${nodeAttrs(out, n, placed)};`);
  for (const c of out.clusters) writeCluster(out, c, placed, '  ', lines);
  for (const e of out.edges) {
    const line = edgeLine(out, e);
    if (line !== null) lines.push(`  ${line}`);
  }
  lines.push('}');
  return { text: `${lines.join('\n')}\n`, warnings: out.warnings.all() };
}
