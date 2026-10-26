/**
 * A Graphviz DOT graph as a one-page document: clusters as containers, the
 * rest of the grammar's scoping read the way Graphviz reads it. Positions are
 * kept only when every node has a `pos`; otherwise the page is laid out on
 * import.
 */
import type { MarkerRef } from '@weasel-js/core';
import type { DataContainer, DataEdge, DataNode, EdgeStyle, LayoutDirection, NodeStyle } from '@weasel-js/diagram';
import type { ImportResult } from '../document';
import { Membership, Warnings, graphPage } from '../graphRead';
import { parseDot, type DotGraph, type DotNodeRef, type DotStmt, type DotSubgraph, type DotValue } from './parse';
import { dashOf, dotColor, labelLines, markerOf, OUTLINE_ATTR, outlineOf, stylesOf } from './values';

type Attrs = Map<string, DotValue>;
interface Scope { kind: 'root' | 'cluster' | 'plain'; graph: Attrs; node: Attrs; edge: Attrs; cluster: string | null }
interface RawEdge { tail: DotNodeRef; head: DotNodeRef; attrs: Attrs }

const READ: Readonly<Record<'root' | 'cluster' | 'plain' | 'node' | 'edge', ReadonlySet<string>>> = {
  root: new Set(['rankdir', 'label', 'bb']),
  cluster: new Set(['label', 'style', 'color', 'fillcolor', 'bgcolor', 'pencolor', 'fontcolor']),
  plain: new Set(),
  node: new Set([OUTLINE_ATTR, 'label', 'shape', 'style', 'color', 'fillcolor', 'fontcolor', 'penwidth', 'width', 'height', 'pos']),
  edge: new Set(['label', 'color', 'fontcolor', 'penwidth', 'style', 'dir', 'arrowhead', 'arrowtail', 'tailport', 'headport']),
};

const DIRECTIONS: Readonly<Record<string, LayoutDirection>> = { TB: 'down', BT: 'up', LR: 'right', RL: 'left' };
const COMPASS_PORTS = new Set(['n', 'e', 's', 'w']);
const POINTS_PER_INCH = 72;

const round = (n: number) => Math.round(n * 100) / 100;
const str = (attrs: Attrs, key: string) => attrs.get(key)?.value;

class DotReader {
  readonly warnings = new Warnings();
  readonly membership = new Membership(this.warnings, 'DOT');
  readonly nodes = new Map<string, Attrs>();
  readonly edges: RawEdge[] = [];
  readonly clusters = new Map<string, Attrs>();

  constructor(readonly graph: DotGraph) {}

  dropUnread(kind: keyof typeof READ, keys: Iterable<string>): void {
    for (const key of keys) if (!READ[kind].has(key)) this.warnings.list('DOT attributes a diagram does not hold were dropped', key);
  }

  touch(ref: DotNodeRef, scope: Scope, named: Set<string>): void {
    if (!this.nodes.has(ref.id)) this.nodes.set(ref.id, new Map(scope.node));
    this.membership.place(ref.id, scope.cluster);
    named.add(ref.id);
  }

  walk(stmts: readonly DotStmt[], scope: Scope): Set<string> {
    const named = new Set<string>();
    for (const s of stmts) {
      if (s.kind === 'set' || (s.kind === 'attr' && s.target === 'graph')) {
        const pairs = s.kind === 'set' ? [{ key: s.key, value: s.value }] : s.attrs;
        this.dropUnread(scope.kind, pairs.map((a) => a.key));
        for (const a of pairs) scope.graph.set(a.key, a.value);
      } else if (s.kind === 'attr') {
        this.dropUnread(s.target as 'node' | 'edge', s.attrs.map((a) => a.key));
        for (const a of s.attrs) scope[s.target].set(a.key, a.value);
      } else if (s.kind === 'node') {
        this.touch(s.node, scope, named);
        this.dropUnread('node', s.attrs.map((a) => a.key));
        for (const a of s.attrs) this.nodes.get(s.node.id)!.set(a.key, a.value);
      } else if (s.kind === 'subgraph') {
        for (const id of this.subgraph(s, scope)) named.add(id);
      } else {
        this.dropUnread('edge', s.attrs.map((a) => a.key));
        const ends = s.ends.map((end) => this.end(end, scope));
        for (const id of ends.flat()) named.add(id.id);
        const attrs = new Map(scope.edge);
        for (const a of s.attrs) attrs.set(a.key, a.value);
        for (let k = 1; k < ends.length; k++) {
          for (const tail of ends[k - 1]!) for (const head of ends[k]!) this.edges.push({ tail, head, attrs });
        }
      }
    }
    return named;
  }

  end(end: DotNodeRef | DotSubgraph, scope: Scope): DotNodeRef[] {
    if (!('stmts' in end)) {
      this.touch(end, scope, new Set());
      return [end];
    }
    return [...this.subgraph(end, scope)].map((id) => ({ id, line: end.line }));
  }

  subgraph(sub: DotSubgraph, parent: Scope): Set<string> {
    const isCluster = sub.id !== undefined && sub.id.startsWith('cluster');
    if (isCluster) this.membership.openCluster(sub.id!, parent.cluster);
    const graph = isCluster ? (this.clusters.get(sub.id!) ?? new Map(parent.graph)) : new Map(parent.graph);
    if (isCluster) this.clusters.set(sub.id!, graph);
    return this.walk(sub.stmts, {
      kind: isCluster ? 'cluster' : 'plain', graph, node: new Map(parent.node), edge: new Map(parent.edge),
      cluster: isCluster ? sub.id! : parent.cluster,
    });
  }
}

function nodeColors(attrs: Attrs, styles: readonly string[]): Partial<NodeStyle> | undefined {
  const fill = styles.includes('filled') ? str(attrs, 'fillcolor') ?? str(attrs, 'color') ?? 'lightgrey' : undefined;
  const stroke = str(attrs, 'color');
  const text = str(attrs, 'fontcolor');
  const width = str(attrs, 'penwidth');
  const dash = dashOf(styles);
  const colors: Partial<NodeStyle> = {
    ...(fill !== undefined ? { fill: dotColor(fill) } : {}),
    ...(stroke !== undefined ? { stroke: dotColor(stroke) } : {}),
    ...(text !== undefined ? { text: dotColor(text) } : {}),
    ...(width !== undefined ? { strokeWidth: Number(width) } : {}),
    ...(dash !== undefined ? { dash } : {}),
  };
  return Object.keys(colors).length > 0 ? colors : undefined;
}

function readNode(r: DotReader, id: string, attrs: Attrs): DataNode {
  const styles = stylesOf(str(attrs, 'style'));
  const shape = str(attrs, 'shape') ?? 'ellipse';
  let outline = str(attrs, OUTLINE_ATTR) ?? outlineOf(shape, styles);
  if (outline === null) {
    r.warnings.list('DOT shapes read as rectangles', shape);
    outline = 'rect';
  }
  const colors = nodeColors(attrs, styles);
  const width = str(attrs, 'width');
  const height = str(attrs, 'height');
  return {
    id,
    lines: labelLines(attrs.get('label') ?? { value: '\\N' }, id, r.graph.id ?? ''),
    outline,
    ...(width !== undefined ? { width: round(Number(width) * POINTS_PER_INCH) } : {}),
    ...(height !== undefined ? { height: round(Number(height) * POINTS_PER_INCH) } : {}),
    ...(colors !== undefined ? { colors } : {}),
  };
}

/** Each node's place from its `pos`, and the page's size, when every node has one; else `null`. */
function positions(nodes: DataNode[], attrs: ReadonlyMap<string, Attrs>, bb: string | undefined) {
  const centers = nodes.map((n) => str(attrs.get(n.id)!, 'pos')?.replace(/!$/, '').split(',').map(Number));
  if (nodes.length === 0 || centers.some((c) => c === undefined || c.length < 2 || c.some(Number.isNaN))) return null;
  const size = (n: DataNode) => ({ w: n.width ?? 0.75 * POINTS_PER_INCH, h: n.height ?? 0.5 * POINTS_PER_INCH });
  const box = bb?.split(',').map(Number);
  const [llx, lly, urx, ury] = box?.length === 4 && !box.some(Number.isNaN) ? box : [0, 0, undefined, undefined];
  const top = ury ?? Math.max(...nodes.map((n, i) => centers[i]![1]! + size(n).h / 2));
  const right = urx ?? Math.max(...nodes.map((n, i) => centers[i]![0]! + size(n).w / 2));
  const placed = nodes.map((n, i) => ({
    ...n, at: { x: round(centers[i]![0]! - llx! - size(n).w / 2), y: round(top - centers[i]![1]! - size(n).h / 2) },
  }));
  return { nodes: placed, size: { width: round(right - llx!), height: round(top - lly!) } };
}

function portOf(r: DotReader, ref: DotNodeRef, attr: string | undefined): string | undefined {
  const [port, compass] = ref.port !== undefined || ref.compass !== undefined ? [ref.port, ref.compass]
    : attr === undefined ? [undefined, undefined]
    : attr.includes(':') ? attr.split(':') : COMPASS_PORTS.has(attr) || attr === '_' ? [undefined, attr] : [attr, undefined];
  if (port === undefined && (compass === undefined || compass === '_')) return undefined;
  if (port === undefined && COMPASS_PORTS.has(compass!)) return compass;
  r.warnings.list('DOT ports a diagram does not have were dropped', [ref.id, port, compass].filter((p) => p !== undefined).join(':'));
  return undefined;
}

function marker(r: DotReader, name: string | undefined): MarkerRef | null {
  const m = markerOf(name ?? 'normal');
  if (m !== undefined) return m;
  r.warnings.list('DOT arrowheads drawn as arrows', name!);
  return 'arrow';
}

function readEdge(r: DotReader, e: RawEdge): DataEdge {
  const styles = stylesOf(str(e.attrs, 'style'));
  const dir = str(e.attrs, 'dir') ?? (r.graph.directed ? 'forward' : 'none');
  const end = dir === 'forward' || dir === 'both' ? marker(r, str(e.attrs, 'arrowhead')) : null;
  const start = dir === 'back' || dir === 'both' ? marker(r, str(e.attrs, 'arrowtail')) : null;
  const stroke = str(e.attrs, 'color');
  const label = str(e.attrs, 'fontcolor');
  const width = str(e.attrs, 'penwidth');
  const dash = dashOf(styles);
  const colors: Partial<EdgeStyle> = {
    ...(stroke !== undefined ? { stroke: dotColor(stroke) } : {}),
    ...(label !== undefined ? { label: dotColor(label) } : {}),
    ...(width !== undefined ? { width: Number(width) } : {}),
    ...(dash !== undefined ? { dash } : {}),
    ...(start !== null ? { markerStart: start } : {}),
    ...(end !== 'arrow' ? { markerEnd: end } : {}),
  };
  const fromPort = portOf(r, e.tail, str(e.attrs, 'tailport'));
  const toPort = portOf(r, e.head, str(e.attrs, 'headport'));
  const text = e.attrs.get('label');
  const lines = text === undefined ? [] : labelLines(text, '', r.graph.id ?? '');
  return {
    from: e.tail.id, to: e.head.id,
    ...(fromPort !== undefined ? { fromPort } : {}),
    ...(toPort !== undefined ? { toPort } : {}),
    ...(lines.length > 0 ? { label: lines.join(' ') } : {}),
    ...(Object.keys(colors).length > 0 ? { colors } : {}),
  };
}

function readCluster(r: DotReader, id: string, attrs: Attrs, ids: ReadonlyMap<string, string>): DataContainer {
  const styles = stylesOf(str(attrs, 'style'));
  const fill = str(attrs, 'fillcolor') ?? str(attrs, 'color') ?? str(attrs, 'bgcolor');
  const bg = str(attrs, 'bgcolor');
  const stroke = str(attrs, 'pencolor') ?? str(attrs, 'color');
  const text = str(attrs, 'fontcolor');
  const colors: Partial<NodeStyle> = {
    ...(styles.includes('filled') && fill !== undefined ? { fill: dotColor(fill) } : bg !== undefined ? { fill: dotColor(bg) } : {}),
    ...(stroke !== undefined ? { stroke: dotColor(stroke) } : {}),
    ...(text !== undefined ? { text: dotColor(text) } : {}),
  };
  const label = attrs.get('label');
  const lines = label === undefined ? [] : labelLines(label, id, r.graph.id ?? '');
  const members = r.membership.members(id).map((m) => ids.get(m) ?? m);
  return {
    id: ids.get(id)!, role: 'container',
    ...(lines.length > 0 ? { label: lines.join(' ') } : {}),
    ...(members.length > 0 ? { members } : {}),
    ...(Object.keys(colors).length > 0 ? { colors } : {}),
  };
}

/** Container ids for clusters: the name less its `cluster` prefix, where that is free. */
function clusterIds(clusters: Iterable<string>, nodes: ReadonlyMap<string, unknown>): Map<string, string> {
  const taken = new Set([...nodes.keys()]);
  const out = new Map<string, string>();
  for (const id of clusters) {
    const short = id.replace(/^cluster_?/, '');
    const pick = short !== '' && !taken.has(short) && !out.has(short) ? short : id;
    taken.add(pick);
    out.set(id, pick);
  }
  return out;
}

/** Reads DOT source into a one-page document. Throws, naming the line, on text that is not a DOT graph. */
export function readDot(text: string): ImportResult {
  const graph = parseDot(text);
  const r = new DotReader(graph);
  const root: Scope = { kind: 'root', graph: new Map(), node: new Map(), edge: new Map(), cluster: null };
  r.walk(graph.stmts, root);
  let nodes = [...r.nodes].map(([id, attrs]) => readNode(r, id, attrs));
  const placed = positions(nodes, r.nodes, str(root.graph, 'bb'));
  if (placed !== null) nodes = placed.nodes;
  else if ([...r.nodes.values()].some((a) => a.has('pos'))) r.warnings.list('DOT attributes a diagram does not hold were dropped', 'pos');
  const seen = new Set<string>();
  const edges = r.edges.filter((e) => {
    if (!graph.strict) return true;
    const key = graph.directed ? `${e.tail.id}\u0000${e.head.id}` : [e.tail.id, e.head.id].sort().join('\u0000');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((e) => readEdge(r, e));
  const ids = clusterIds(r.clusters.keys(), r.nodes);
  const containers = [...r.clusters].map(([id, attrs]) => readCluster(r, id, attrs, ids));
  const rankdir = str(root.graph, 'rankdir')?.toUpperCase();
  const name = root.graph.get('label');
  const page = graphPage({
    name: name !== undefined ? labelLines(name, '', graph.id ?? '').join(' ') : graph.id,
    ...(rankdir !== undefined && DIRECTIONS[rankdir] ? { direction: DIRECTIONS[rankdir] } : {}),
    nodes, edges, containers,
    ...(placed !== null ? { size: placed.size } : {}),
  });
  return { document: { pages: [page] }, warnings: r.warnings.all() };
}
