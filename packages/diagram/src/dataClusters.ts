/**
 * `diagramScene`'s clusters: which nodes each one holds, and the box and label
 * it draws around them.
 */
import { maxOf, minOf, type Rect } from '@weasel-js/geom';
import type { ClusterInset } from './cluster';
import type { DataCluster, DiagramSceneData, DiagramSpec, NodeStyle } from './dataTypes';
import { ANCHOR_DERIVE_POSE, CLUSTER_DERIVE_POSE, boxAround, type DiagramAnchor } from './clusterBox';
import { nestClusters } from './clusterTree';

/** A cluster with its members settled and its inset worked out. */
export interface ResolvedCluster {
  cluster: DataCluster;
  /** The nodes and clusters directly inside, which the box derives from. */
  direct: readonly string[];
  /** Every node inside, through any nested cluster. */
  members: readonly string[];
  /** The cluster this one is directly inside. */
  parent?: string;
  inset: ClusterInset;
  pad: number;
  title: { width: number; height: number } | null;
  /** Room for the title across the box, when there is one. */
  minWidth?: number;
}

/** The width a cluster's box needs to hold a title `title` wide, `pad` in from either side. */
export const clusterMinWidth = (title: number, pad: number): number => title + 2 * pad;

/**
 * Settle what each cluster holds (see `nestClusters`), outer clusters ahead of the
 * clusters inside them. A cluster left with no node inside it is dropped. Throws
 * on a cluster id already in `ids`, and adds each cluster's id to it.
 */
export function resolveClusters(
  clusters: readonly DataCluster[],
  ids: Set<string>,
  nodeIds: ReadonlySet<string>,
  opts: { padding: number; title: (text: string) => { width: number; height: number } },
): ResolvedCluster[] {
  for (const cluster of clusters) {
    if (ids.has(cluster.id)) throw new Error(`diagramScene: cluster id "${cluster.id}" is already a node or cluster id`);
    ids.add(cluster.id);
  }
  const declared = new Map(clusters.map((g) => [g.id, g]));
  const nested = nestClusters(clusters, (id) => nodeIds.has(id));
  const depthOf = new Map<string, number>();
  const byId = new Map(nested.map((g) => [g.id, g]));
  const depth = (id: string): number => {
    const parent = byId.get(id)!.parent;
    let d = depthOf.get(id);
    if (d === undefined) depthOf.set(id, (d = parent === undefined ? 0 : depth(parent) + 1));
    return d;
  };
  // Stable, so clusters at one depth keep the order they were declared in.
  return nested.map((g, i) => ({ g, i })).sort((a, b) => depth(a.g.id) - depth(b.g.id) || a.i - b.i).map(({ g }) => {
    const cluster = declared.get(g.id)!;
    const pad = cluster.padding ?? opts.padding;
    const title = cluster.label ? opts.title(cluster.label) : null;
    // The label sits in the top inset, half a pad above what the box holds.
    const inset = { top: pad + (title ? title.height + pad / 2 : 0), right: pad, bottom: pad, left: pad };
    return {
      cluster, direct: g.direct, members: g.members, inset, pad, title,
      ...(title ? { minWidth: clusterMinWidth(title.width, pad) } : {}),
      ...(g.parent !== undefined ? { parent: g.parent } : {}),
    };
  });
}

/** The node id of a cluster's title. */
export const clusterLabelIdOf = (id: string): string => `${id}/label`;

/** A label on a wire, as a cluster box takes it in: the label node's id, and
 *  where it sits when that is known before the scene derives it. */
export interface WireLabel {
  id: string;
  from: string;
  to: string;
  at: Rect | null;
}

/** The labels each cluster's box takes in: those on wires with both ends
 *  inside it, each in the innermost cluster holding both. */
export function labelsByCluster(clusters: readonly ResolvedCluster[], labels: readonly WireLabel[]): Map<string, WireLabel[]> {
  const byId = new Map(clusters.map((g) => [g.cluster.id, g]));
  const holder = new Map<string, string>();
  for (const g of clusters) for (const m of g.direct) holder.set(m, g.cluster.id);
  const ancestry = (id: string): string[] => {
    const out: string[] = [];
    for (let at = byId.has(id) ? byId.get(id)!.parent : holder.get(id); at !== undefined; at = byId.get(at)?.parent) out.push(at);
    return out;
  };
  const out = new Map<string, WireLabel[]>();
  for (const label of labels) {
    const up = new Set(ancestry(label.to));
    const shared = ancestry(label.from).find((g) => up.has(g));
    if (shared !== undefined) out.set(shared, [...(out.get(shared) ?? []), label]);
  }
  return out;
}

/** Each cluster's box around where its members were placed, and the labels
 *  it takes in where they are known. */
export function clusterBoxes(
  clusters: readonly ResolvedCluster[],
  placedAt: ReadonlyMap<string, Rect>,
  labels: ReadonlyMap<string, readonly WireLabel[]> = new Map(),
): Map<string, Rect> {
  const byId = new Map(clusters.map((g) => [g.cluster.id, g]));
  const boxes = new Map<string, Rect>();
  const boxOf = (id: string): Rect => {
    const known = boxes.get(id);
    if (known !== undefined) return known;
    const g = byId.get(id)!;
    const rs = g.direct.map((m) => (byId.has(m) ? boxOf(m) : placedAt.get(m)!));
    for (const label of labels.get(id) ?? []) if (label.at !== null) rs.push(label.at);
    const x = minOf(rs, (r) => r.x);
    const y = minOf(rs, (r) => r.y);
    const box = boxAround({
      x,
      y,
      width: maxOf(rs, (r) => r.x + r.width) - x,
      height: maxOf(rs, (r) => r.y + r.height) - y,
    }, g);
    boxes.set(id, box);
    return box;
  };
  for (const g of clusters) boxOf(g.cluster.id);
  return boxes;
}

/**
 * Each cluster's box, and its label when it has one, around where its members
 * were placed. In the order given, so an outer box paints behind the boxes
 * inside it. A box depends on its members and on the labels it takes in
 * (see {@link labelsByCluster}), so a wire's label stays inside it.
 */
export function clusterSpecs(
  clusters: readonly ResolvedCluster[],
  placedAt: ReadonlyMap<string, Rect>,
  styleOf: (cluster: DataCluster) => { style: NodeStyle; text: NonNullable<DiagramSceneData['style']> },
  wireLabels: readonly WireLabel[] = [],
): DiagramSpec[] {
  const labels = labelsByCluster(clusters, wireLabels);
  const boxes = clusterBoxes(clusters, placedAt, labels);
  const specs: DiagramSpec[] = [];
  for (const g of clusters) {
    const { style, text } = styleOf(g.cluster);
    const { x, y, width, height } = boxes.get(g.cluster.id)!;
    specs.push({
      id: g.cluster.id as never,
      kind: 'mark',
      layer: 'main',
      pose: { x, y, width, height },
      data: {
        diagram: {
          outline: 'rect',
          cluster: {
            inset: g.inset,
            ...(g.minWidth !== undefined ? { minWidth: g.minWidth } : {}),
            ...(g.cluster.reorder !== undefined ? { reorder: g.cluster.reorder } : {}),
          },
        },
        fill: { paint: { color: style.fill } },
        stroke: {
          paint: { color: style.stroke },
          width: style.strokeWidth ?? 1,
          ...(style.dash ? { dash: style.dash } : {}),
        },
      },
      dependsOn: [...g.direct, ...(labels.get(g.cluster.id) ?? []).map((l) => l.id)] as never[],
      derivePose: CLUSTER_DERIVE_POSE as never,
    });
    if (g.title === null || !g.cluster.label) continue;
    const anchor: DiagramAnchor = { at: { u: 0, v: 0 }, offset: { x: g.pad, y: g.pad } };
    specs.push({
      id: clusterLabelIdOf(g.cluster.id) as never,
      kind: 'mark',
      layer: 'main',
      pickable: false,
      pose: { x: x + g.pad, y: y + g.pad, width: g.title.width, height: g.title.height },
      data: { diagram: { anchor }, text: g.cluster.label, style: text, fill: { paint: { color: style.text } } },
      dependsOn: [g.cluster.id as never],
      derivePose: ANCHOR_DERIVE_POSE as never,
    });
  }
  return specs;
}
