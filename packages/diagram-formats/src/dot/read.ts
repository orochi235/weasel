/**
 * A Graphviz DOT graph as a one-page document: clusters as containers, the
 * rest of the grammar's scoping read the way Graphviz reads it. Positions are
 * kept only when every node has a `pos`; otherwise the page is laid out on
 * import.
 */
import type { MarkerRef } from '@weasel-js/core';
import { outlineRegistry, type DataContainer, type DataEdge, type DataNode, type EdgeStyle, type LayoutDirection, type NodeStyle, type Outline } from '@weasel-js/diagram';
import { compositeKey, freshId, getOwn } from '@weasel-js/registry';
import { checkedColor } from '../colorCheck';
import type { ImportResult } from '../document';
import { Membership, Warnings, graphPage } from '../graphRead';
import { parseDot, type DotGraph, type DotNodeRef, type DotStmt, type DotSubgraph, type DotValue } from './parse';
import { dashOf, dotColor, labelLines, markerOf, OUTLINE_ATTR, outlineOf, stylesOf } from './values';

type Attrs = Map<string, DotValue>;
interface Scope { kind: 'root' | 'cluster' | 'plain'; graph: Attrs; node: Attrs; edge: Attrs; cluster: string | null }
/** An edge as a statement made it: `own` the attributes the statement names, `attrs` those over its scope's defaults. */
interface RawEdge { tail: DotNodeRef; head: DotNodeRef; attrs: Attrs; own: Attrs }

const READ: Readonly<Record<'root' | 'cluster' | 'plain' | 'node' | 'edge', ReadonlySet<string>>> = {
  root: new Set(['rankdir', 'label', 'bb', 'cluster']),
  cluster: new Set(['cluster', 'label', 'style', 'color', 'fillcolor', 'bgcolor', 'pencolor', 'fontcolor', 'penwidth']),
  plain: new Set(['cluster']),
  node: new Set([OUTLINE_ATTR, 'label', 'shape', 'style', 'color', 'fillcolor', 'fontcolor', 'penwidth', 'width', 'height', 'pos']),
  edge: new Set(['label', 'taillabel', 'headlabel', 'color', 'fontcolor', 'penwidth', 'style', 'dir', 'arrowhead', 'arrowtail', 'tailport', 'headport']),
};

const DIRECTIONS: Readonly<Record<string, LayoutDirection>> = { TB: 'down', BT: 'up', LR: 'right', RL: 'left' };
const COMPASS_PORTS = new Set(['n', 'e', 's', 'w']);
const POINTS_PER_INCH = 72;
/** A cluster's key starts with this when it has no name, followed by a count, and twice over when its name does. */
const ANONYMOUS = '\u0000';
const clusterKey = (id: string) => (id.startsWith(ANONYMOUS) ? `${ANONYMOUS}${id}` : id);
/** A cluster's name from its key; `''` for one with none. */
const clusterName = (key: string) =>
  key.startsWith(`${ANONYMOUS}${ANONYMOUS}`) ? key.slice(1) : key.startsWith(ANONYMOUS) ? '' : key;

/** A DOT boolean as Graphviz reads one: `true` or `yes` in any case, or a nonzero integer. */
const truthy = (v: string | undefined) => v !== undefined && (/^(?:true|yes)$/i.test(v.trim()) || (parseInt(v, 10) || 0) !== 0);

/** The `cluster` attribute a subgraph ends with: its own last statement setting it, else what it inherits. */
function clusterFlag(stmts: readonly DotStmt[], inherited: Attrs): boolean {
  let flag = str(inherited, 'cluster');
  for (const s of stmts) {
    if (s.kind === 'set' && s.key === 'cluster') flag = s.value.value;
    else if (s.kind === 'attr' && s.target === 'graph') for (const a of s.attrs) if (a.key === 'cluster') flag = a.value.value;
  }
  return truthy(flag);
}

const round = (n: number) => Math.round(n * 100) / 100;
const str = (attrs: Attrs, key: string) => attrs.get(key)?.value;
/** A keyword attribute, `undefined` when unset or set to `""`, which Graphviz reads as its default. */
const keyword = (attrs: Attrs, key: string) => str(attrs, key) || undefined;

/** A color attribute as CSS reads it; `undefined` for one unset or set to `""`, Graphviz's default, and, with a warning,
 *  for one naming a color a diagram cannot draw. */
function colorAttr(r: DotReader, attrs: Attrs, key: string): string | undefined {
  const raw = str(attrs, key);
  return raw === undefined || raw === '' ? undefined : checkedColor(dotColor(raw) ?? raw, 'DOT', (lead, item) => r.warnings.list(lead, item));
}

/** An attribute as a number; `undefined` for one unset or set to `""`, Graphviz's default, and, with a warning, for
 *  one that is not a number. */
function numberAttr(r: DotReader, attrs: Attrs, key: string): number | undefined {
  const raw = str(attrs, key);
  if (raw === undefined || raw === '') return undefined;
  const n = raw.trim() === '' ? NaN : Number(raw);
  if (Number.isFinite(n)) return n;
  r.warnings.list('DOT attributes that are not numbers were dropped', `${key}=${raw}`);
  return undefined;
}

class DotReader {
  readonly warnings = new Warnings();
  readonly membership = new Membership(this.warnings, 'DOT');
  readonly nodes = new Map<string, Attrs>();
  readonly edges: RawEdge[] = [];
  readonly clusters = new Map<string, Attrs>();
  private anonymous = 0;

  readonly root: Scope = { kind: 'root', graph: new Map(), node: new Map(), edge: new Map(), cluster: null };

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
        const own: Attrs = new Map(s.attrs.map((a) => [a.key, a.value]));
        const attrs = new Map([...scope.edge, ...own]);
        for (let k = 1; k < ends.length; k++) {
          for (const tail of ends[k - 1]!) for (const head of ends[k]!) this.edges.push({ tail, head, attrs, own });
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

  /** A new cluster's attributes, less the root's `bgcolor`: a page draws none, so the cluster has no canvas to blend into. */
  clusterGraph(parent: Attrs): Attrs {
    const graph = new Map(parent);
    if (graph.get('bgcolor') === this.root.graph.get('bgcolor')) graph.delete('bgcolor');
    return graph;
  }

  subgraph(sub: DotSubgraph, parent: Scope): Set<string> {
    // Graphviz matches the prefix in any case, and since version 7 takes `cluster=true` too.
    const isCluster = sub.id !== undefined
      ? /^cluster/i.test(sub.id) || this.clusters.has(clusterKey(sub.id)) || clusterFlag(sub.stmts, parent.graph)
      : clusterFlag(sub.stmts, parent.graph);
    const key = !isCluster ? null : sub.id !== undefined ? clusterKey(sub.id) : `${ANONYMOUS}${this.anonymous++}`;
    if (key !== null) this.membership.openCluster(key, parent.cluster);
    const graph = key !== null ? (this.clusters.get(key) ?? this.clusterGraph(parent.graph)) : new Map(parent.graph);
    if (key !== null) this.clusters.set(key, graph);
    return this.walk(sub.stmts, {
      kind: key !== null ? 'cluster' : 'plain', graph, node: new Map(parent.node), edge: new Map(parent.edge),
      cluster: key ?? parent.cluster,
    });
  }
}

function nodeColors(r: DotReader, attrs: Attrs, styles: readonly string[], unsetFill: string): Partial<NodeStyle> | undefined {
  const stroke = colorAttr(r, attrs, 'color');
  const fill = styles.includes('filled') ? colorAttr(r, attrs, 'fillcolor') ?? stroke ?? unsetFill : undefined;
  const text = colorAttr(r, attrs, 'fontcolor');
  const width = numberAttr(r, attrs, 'penwidth');
  const dash = dashOf(styles);
  const colors: Partial<NodeStyle> = {
    ...(fill !== undefined ? { fill } : {}),
    ...(stroke !== undefined ? { stroke } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(width !== undefined ? { strokeWidth: width } : {}),
    ...(dash !== undefined ? { dash } : {}),
  };
  return Object.keys(colors).length > 0 ? colors : undefined;
}

function readNode(r: DotReader, id: string, attrs: Attrs): DataNode {
  const styles = stylesOf(str(attrs, 'style'));
  const shape = keyword(attrs, 'shape') ?? 'ellipse';
  const named = keyword(attrs, OUTLINE_ATTR);
  const known = named !== undefined && outlineRegistry.has(named);
  if (named !== undefined && !known) r.warnings.list('DOT outlines a diagram does not have were read from the shape', named);
  let outline: Outline | null = known ? named : outlineOf(shape, styles);
  if (outline === null) {
    r.warnings.list('DOT shapes read as rectangles', shape);
    outline = 'rect';
  }
  const point = shape.toLowerCase() === 'point';
  const colors = nodeColors(r, attrs, point ? [...styles, 'filled'] : styles, point ? 'black' : 'lightgrey');
  let width = numberAttr(r, attrs, 'width');
  let height = numberAttr(r, attrs, 'height');
  // Graphviz draws a point with no label, as a circle the smaller of its sizes across, 0.05in when neither is set.
  if (point) width = height = Math.min(width ?? height ?? 0.05, height ?? width ?? 0.05);
  return {
    id,
    lines: point ? [] : labelLines(attrs.get('label') ?? { value: '\\N' }, id, r.graph.id ?? ''),
    outline,
    ...(width !== undefined ? { width: round(width * POINTS_PER_INCH) } : {}),
    ...(height !== undefined ? { height: round(height * POINTS_PER_INCH) } : {}),
    ...(colors !== undefined ? { colors } : {}),
  };
}

const least = (m: number, v: number) => Math.min(m, v);
const most = (m: number, v: number) => Math.max(m, v);

/** Each node's place from its `pos`, and the page's size, when every node has one; else `null`. A graph with a `bb` is
 *  layout output, its `pos` in points; one without is input to neato, its `pos` in inches. */
function positions(nodes: DataNode[], attrs: ReadonlyMap<string, Attrs>, bb: string | undefined) {
  const unit = bb === undefined ? POINTS_PER_INCH : 1;
  const centers = nodes.map((n) => str(attrs.get(n.id)!, 'pos')?.replace(/!$/, '').split(',').map((v) => Number(v) * unit));
  if (nodes.length === 0 || centers.some((c) => c === undefined || c.length < 2 || !c.every(Number.isFinite))) return null;
  const size = (n: DataNode) => ({ width: n.width ?? 0.75 * POINTS_PER_INCH, height: n.height ?? 0.5 * POINTS_PER_INCH });
  const box = bb?.split(',').map(Number);
  const xs = nodes.flatMap((n, i) => [centers[i]![0]! - size(n).width / 2, centers[i]![0]! + size(n).width / 2]);
  const ys = nodes.flatMap((n, i) => [centers[i]![1]! - size(n).height / 2, centers[i]![1]! + size(n).height / 2]);
  const [llx, lly, right, top] = box?.length === 4 && box.every(Number.isFinite)
    ? box : [xs.reduce(least, Infinity), ys.reduce(least, Infinity), xs.reduce(most, -Infinity), ys.reduce(most, -Infinity)];
  const placed = nodes.map((n, i) => ({
    ...n, ...size(n), at: { x: round(centers[i]![0]! - llx! - size(n).width / 2), y: round(top - centers[i]![1]! - size(n).height / 2) },
  }));
  return { nodes: placed, size: { width: round(right - llx!), height: round(top - lly!) } };
}

function portOf(r: DotReader, ref: DotNodeRef, attr: string | undefined): string | undefined {
  const [port, compass] = hasPort(ref) ? [ref.port, ref.compass]
    : attr === undefined || attr === '' ? [undefined, undefined]
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
  const dir = keyword(e.attrs, 'dir') ?? (r.graph.directed ? 'forward' : 'none');
  const end = dir === 'forward' || dir === 'both' ? marker(r, keyword(e.attrs, 'arrowhead')) : null;
  const start = dir === 'back' || dir === 'both' ? marker(r, keyword(e.attrs, 'arrowtail')) : null;
  const stroke = colorAttr(r, e.attrs, 'color');
  const label = colorAttr(r, e.attrs, 'fontcolor');
  const width = numberAttr(r, e.attrs, 'penwidth');
  const dash = dashOf(styles);
  const colors: Partial<EdgeStyle> = {
    ...(stroke !== undefined ? { stroke } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(dash !== undefined ? { dash } : {}),
    ...(start !== null ? { markerStart: start } : {}),
    ...(end !== 'arrow' ? { markerEnd: end } : {}),
  };
  const fromPort = portOf(r, e.tail, str(e.attrs, 'tailport'));
  const toPort = portOf(r, e.head, str(e.attrs, 'headport'));
  const names = { edge: `${e.tail.id}${r.graph.directed ? '->' : '--'}${e.head.id}`, tail: e.tail.id, head: e.head.id };
  const textOf = (key: string) => {
    const value = e.attrs.get(key);
    const joined = value === undefined ? '' : labelLines(value, undefined, r.graph.id ?? '', names).join(' ');
    return joined === '' ? undefined : joined;
  };
  const lines = [textOf('label')].filter((l) => l !== undefined);
  const endLabels = { ...(textOf('taillabel') ? { from: textOf('taillabel') } : {}), ...(textOf('headlabel') ? { to: textOf('headlabel') } : {}) };
  return {
    from: e.tail.id, to: e.head.id,
    ...(fromPort !== undefined ? { fromPort } : {}),
    ...(toPort !== undefined ? { toPort } : {}),
    ...(lines.length > 0 ? { label: lines.join(' ') } : {}),
    ...(Object.keys(endLabels).length > 0 ? { endLabels } : {}),
    ...(Object.keys(colors).length > 0 ? { colors } : {}),
  };
}

function readCluster(
  r: DotReader, id: string, attrs: Attrs, ids: ReadonlyMap<string, string>, unseen: ReadonlySet<string>,
): DataContainer {
  const styles = stylesOf(str(attrs, 'style'));
  const members = r.membership.members(id, ids).filter((m) => !unseen.has(m));
  // Graphviz draws neither an invisible cluster's box nor its label, but still lays its members out together.
  if (styles.includes('invis')) {
    return { id: ids.get(id)!, role: 'container', ...(members.length > 0 ? { members } : {}), colors: { fill: 'transparent', stroke: 'transparent' } };
  }
  const color = colorAttr(r, attrs, 'color');
  const bg = colorAttr(r, attrs, 'bgcolor');
  const fill = styles.includes('filled') ? colorAttr(r, attrs, 'fillcolor') ?? color ?? bg ?? 'lightgrey' : bg;
  const stroke = colorAttr(r, attrs, 'pencolor') ?? color;
  const text = colorAttr(r, attrs, 'fontcolor');
  const width = numberAttr(r, attrs, 'penwidth');
  const dash = dashOf(styles);
  const colors: Partial<NodeStyle> = {
    ...(fill !== undefined ? { fill } : {}),
    ...(stroke !== undefined ? { stroke } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(width !== undefined ? { strokeWidth: width } : {}),
    ...(dash !== undefined ? { dash } : {}),
  };
  const label = attrs.get('label');
  const lines = label === undefined ? [] : labelLines(label, undefined, clusterName(id));
  return {
    id: ids.get(id)!, role: 'container',
    ...(lines.length > 0 ? { label: lines.join(' ') } : {}),
    ...(members.length > 0 ? { members } : {}),
    ...(Object.keys(colors).length > 0 ? { colors } : {}),
  };
}

/** Container ids for clusters: the name less its `cluster` prefix, where that is free, else the whole name, else that
 *  with the first free suffix. */
function clusterIds(clusters: Iterable<string>, nodes: ReadonlyMap<string, unknown>): Map<string, string> {
  const taken = new Set([...nodes.keys()]);
  const out = new Map<string, string>();
  for (const id of clusters) {
    const name = clusterName(id);
    const short = name.replace(/^cluster_?/i, '');
    const pick = short !== '' && !taken.has(short) ? short : freshId(name || 'cluster', taken, { bare: true });
    taken.add(pick);
    out.set(id, pick);
  }
  return out;
}

const isInvisible = (attrs: Attrs) => stylesOf(str(attrs, 'style')).includes('invis');

const hasPort = (ref: DotNodeRef) => ref.port !== undefined || ref.compass !== undefined;

/** A strict graph's edges: one per pair of ends, the first, with the attributes every later statement naming the
 *  pair sets. */
function strictEdges(edges: readonly RawEdge[], directed: boolean): RawEdge[] {
  const kept = new Map<string, RawEdge>();
  for (const e of edges) {
    const key = compositeKey(directed ? [e.tail.id, e.head.id] : [e.tail.id, e.head.id].sort());
    const first = kept.get(key);
    if (first === undefined) { kept.set(key, e); continue; }
    // An undirected statement may name the pair the other way round; its ports go with the ends they name.
    const [tail, head] = first.tail.id === e.tail.id ? [e.tail, e.head] : [e.head, e.tail];
    kept.set(key, {
      ...first, attrs: new Map([...first.attrs, ...e.own]),
      tail: hasPort(tail) ? tail : first.tail, head: hasPort(head) ? head : first.head,
    });
  }
  return [...kept.values()];
}

/** Reads DOT source into a one-page document. Throws, naming the line, on text that is not a DOT graph. */
export function readDot(text: string): ImportResult {
  const graph = parseDot(text);
  const r = new DotReader(graph);
  const root = r.root;
  r.walk(graph.stmts, root);
  let nodes = [...r.nodes].map(([id, attrs]) => readNode(r, id, attrs));
  const placed = positions(nodes, r.nodes, str(root.graph, 'bb'));
  if (placed !== null) nodes = placed.nodes;
  else if ([...r.nodes.values()].some((a) => a.has('pos'))) r.warnings.list('DOT attributes a diagram does not hold were dropped', 'pos');
  const unseen = new Set([...r.nodes].filter(([, attrs]) => isInvisible(attrs)).map(([id]) => id));
  for (const id of unseen) r.warnings.list('DOT invisible nodes and edges were left out', id);
  nodes = nodes.filter((n) => !unseen.has(n.id));
  const seen = (graph.strict ? strictEdges(r.edges, graph.directed) : r.edges).filter((e) => {
    if (unseen.has(e.tail.id) || unseen.has(e.head.id)) return false;
    if (!isInvisible(e.attrs)) return true;
    r.warnings.list('DOT invisible nodes and edges were left out', `${e.tail.id}${graph.directed ? '->' : '--'}${e.head.id}`);
    return false;
  });
  const edges = seen.map((e) => readEdge(r, e));
  const ids = clusterIds(r.clusters.keys(), r.nodes);
  const containers = [...r.clusters].map(([id, attrs]) => readCluster(r, id, attrs, ids, unseen));
  const rankdir = str(root.graph, 'rankdir')?.toUpperCase();
  const direction = rankdir !== undefined ? getOwn(DIRECTIONS, rankdir) : undefined;
  const name = root.graph.get('label');
  const page = graphPage({
    name: name !== undefined ? labelLines(name, undefined, graph.id ?? '').join(' ') : graph.id,
    ...(direction !== undefined ? { direction } : {}),
    nodes, edges, containers,
    ...(placed !== null ? { size: placed.size } : {}),
  });
  return { document: { pages: [page] }, warnings: r.warnings.all() };
}
