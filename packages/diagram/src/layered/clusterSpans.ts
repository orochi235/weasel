/** Where cluster boxes reach across the rank, from where their nodes sit. */
import { crossInset } from '../cluster';
import type { GraphCluster } from '../graph';
import type { LayoutAxes } from '../layout';

export type Span = readonly [lo: number, hi: number];

/** A node as {@link clusterSpans} reads it: where it reaches across, and the
 *  cluster it is directly in. */
export interface SpanNode {
  cluster: string | undefined;
  span: Span;
}

/**
 * Each cluster's box across the rank around `nodes`: what its members among
 * them take, nested boxes included, grown by its inset and, where across is
 * world x, widened evenly to its `minWidth`, as `packClusters` and
 * `clusterBox` draw it.
 */
export function clusterSpans(clusters: readonly GraphCluster[], nodes: Iterable<SpanNode>, axes: LayoutAxes): Map<string, Span> {
  const byId = new Map(clusters.map((g) => [g.id, g]));
  const inner = new Map<string, Span>();
  const widen = (id: string, [a, b]: Span) => {
    const s = inner.get(id);
    inner.set(id, s === undefined ? [a, b] : [Math.min(s[0], a), Math.max(s[1], b)]);
  };
  for (const n of nodes) {
    for (let g = n.cluster === undefined ? undefined : byId.get(n.cluster); g !== undefined; g = g.parent === undefined ? undefined : byId.get(g.parent)) widen(g.id, n.span);
  }
  const depth = (id: string): number => {
    const p = byId.get(id)?.parent;
    return p === undefined || !byId.has(p) ? 0 : 1 + depth(p);
  };
  const boxes = new Map<string, Span>();
  // Innermost first, so a parent's box takes its children's.
  for (const id of [...inner.keys()].sort((a, b) => depth(b) - depth(a))) {
    const g = byId.get(id)!;
    const [a, b] = inner.get(id)!;
    const inset = crossInset(g.inset, axes);
    const width = b - a + inset.lo + inset.hi;
    const grow = axes.cross === 0 ? Math.max(0, (g.minWidth ?? 0) - width) / 2 : 0;
    const box: Span = [a - inset.lo - grow, b + inset.hi + grow];
    boxes.set(id, box);
    if (g.parent !== undefined) widen(g.parent, box);
  }
  return boxes;
}
