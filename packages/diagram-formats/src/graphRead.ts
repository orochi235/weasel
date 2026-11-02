/**
 * What the Mermaid and Graphviz DOT readers share: a graph's text, its
 * clusters' membership, its edges' ids, and the one page it reads into.
 */
import type { DataContainer, DataEdge, DataNode, LayoutDirection } from '@weasel-js/diagram';
import type { GraphPage } from './document';
import { PAGE_MARGIN } from './pageLayout';

/** Collects warnings, each once, in the order first met. */
export class Warnings {
  private readonly seen = new Set<string>();
  private readonly listed = new Map<string, Set<string>>();

  add(message: string): void {
    this.seen.add(message);
  }

  /** Adds `item` to a list warning: one sentence, `lead` then every item named. */
  list(lead: string, item: string): void {
    if (!this.listed.has(lead)) {
      this.listed.set(lead, new Set());
      this.seen.add(lead);
    }
    this.listed.get(lead)!.add(item);
  }

  all(): string[] {
    return [...this.seen].map((m) => (this.listed.has(m) ? `${m}: ${[...this.listed.get(m)!].join(', ')}.` : m));
  }
}

const NAMED:Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** `text` with its `&name;` and `&#n;` references read; Mermaid's `#name;` and `#n;` too when `hash` is set. */
export function decodeEntities(text: string, hash = false): string {
  const re = hash ? /[&#](#x[\da-f]+|#\d+|x[\da-f]+(?=;)|\d+|[a-z]+);/gi : /&(#x[\da-f]+|#\d+|[a-z]+);/gi;
  return text.replace(re, (whole, ref: string) => {
    const code = /^#?x([\da-f]+)$/i.exec(ref)?.[1];
    if (code !== undefined) return String.fromCodePoint(parseInt(code, 16));
    const num = /^#?(\d+)$/.exec(ref)?.[1];
    if (num !== undefined) return String.fromCodePoint(parseInt(num, 10));
    return NAMED[ref.toLowerCase()] ?? whole;
  });
}

/** Markup's text, one entry per line: `<br>` breaks a line, other tags are dropped. */
export function markupLines(markup: string, hash = false): string[] {
  const text = markup.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  return decodeEntities(text, hash).split('\n').map((l) => l.trim());
}

/**
 * Which cluster each node and cluster sits in directly. A node is placed by
 * the first cluster that names it, moved only into a cluster nested in that
 * one; a second cluster elsewhere is reported and ignored.
 */
export class Membership {
  private readonly parent = new Map<string, string | null>();
  readonly clusterParent = new Map<string, string | null>();

  constructor(private readonly warnings: Warnings, private readonly format: string) {}

  /** Opens `cluster` inside `parent`; a cluster opened again keeps its first place. */
  openCluster(cluster: string, parent: string | null): void {
    if (!this.clusterParent.has(cluster)) this.clusterParent.set(cluster, parent);
  }

  private within(inner: string | null, outer: string): boolean {
    for (let at = inner; at !== null && at !== undefined; at = this.clusterParent.get(at) ?? null) if (at === outer) return true;
    return false;
  }

  /** Records that `cluster` (`null` for the top level) names `node`. */
  place(node: string, cluster: string | null): void {
    const was = this.parent.get(node);
    if (was === undefined || was === null) {
      if (was === undefined || cluster !== null) this.parent.set(node, cluster);
      return;
    }
    if (cluster === null || this.within(was, cluster)) return;
    if (this.within(cluster, was)) this.parent.set(node, cluster);
    else this.warnings.list(`${this.format} nodes in two clusters, kept in the first`, node);
  }

  /** Each cluster's direct members, nodes in the order first placed and nested clusters after. */
  members(cluster: string): string[] {
    const nodes = [...this.parent].filter(([, p]) => p === cluster).map(([id]) => id);
    const clusters = [...this.clusterParent].filter(([, p]) => p === cluster).map(([id]) => id);
    return [...nodes, ...clusters];
  }
}

/** `edges` each given an id unique among themselves and `taken`: `from-to`, then `from-to-2` and on. */
export function withEdgeIds(edges: readonly DataEdge[], taken: Iterable<string>): DataEdge[] {
  const used = new Set(taken);
  return edges.map((e) => {
    const base = `${e.from}-${e.to}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { ...e, id };
  });
}

/** What a graph format read, as the one page it becomes. */
export interface GraphRead {
  name?: string;
  direction?: LayoutDirection;
  nodes: DataNode[];
  edges: DataEdge[];
  containers: DataContainer[];
  /** A size the file gave. Unset, the page starts small and grows to hold what layout places. */
  size?: { width: number; height: number };
}

/** The page a graph format reads into. */
export function graphPage(g: GraphRead): GraphPage {
  const ids = [...g.nodes.map((n) => n.id), ...g.containers.map((c) => c.id)];
  return {
    kind: 'graph',
    id: 'page-1',
    ...(g.name !== undefined && g.name !== '' ? { name: g.name } : {}),
    width: g.size?.width ?? 2 * PAGE_MARGIN,
    height: g.size?.height ?? 2 * PAGE_MARGIN,
    ...(g.direction !== undefined ? { direction: g.direction } : {}),
    data: {
      nodes: g.nodes,
      edges: withEdgeIds(g.edges, ids),
      ...(g.containers.length > 0 ? { containers: g.containers } : {}),
    },
  };
}
