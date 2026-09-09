/**
 * `Graph` — the adjacency index a layout runs over.
 *
 * The scene is the document, so there is no second graph kept in sync with it:
 * this one is built from the scene on demand, used, and thrown away. Rebuilding
 * per layout invocation is deliberate — a maintained index is a cache to
 * invalidate on every add, delete, reparent and `dependsOn` edit, and layout is
 * not on the hot path. Measure before changing that.
 *
 * A node's *identity* is its id and its *size* is its bounds; where it currently
 * sits is here too, because a re-layout that ignores where things already are
 * scrambles a diagram the author has arranged.
 */
import { AUTO_POSE_DESCRIPTOR, type PoseProjection } from '@weasel-js/core';
import { diagramEdgeOf } from './edge';
import type { Bounds } from './outline';
import { diagramNodeOf, type DiagramNodeLike, type DiagramNodeReader } from './trait';

/** A scene node as the graph reads it. `dependsOn` is what an edge's two
 *  endpoints are: the edge trait names *ports*, and the nodes those ports are
 *  on are the dependencies the derivation already runs on. */
export interface GraphNodeLike extends DiagramNodeLike {
  dependsOn?: readonly string[] | 'children';
}

/** Where the graph gets its nodes. The same thunk shape the port affordance
 *  takes, so one source answers both. */
export type GraphSource<TPose> = () => Iterable<{ node: GraphNodeLike; pose: TPose }>;

/** One participant. */
export interface GraphNode {
  id: string;
  /** Where it is now, in world coordinates. */
  bounds: Bounds;
  /** Layout must not move it. */
  pinned: boolean;
}

/** One connection. `id` is the edge node's own id, so a caller can go back to
 *  the scene for its trait. */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

/**
 * Nodes, edges, and the two adjacency reads a layout needs.
 *
 * Every list is in source order — render order, when the source is a scene —
 * which is what a layout's tiebreaks resolve against. There is no RNG anywhere
 * downstream of this, and this is where that starts.
 */
export interface Graph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  node(id: string): GraphNode | undefined;
  /** Edges leaving `id`, in source order. */
  outgoing(id: string): readonly GraphEdge[];
  /** Edges arriving at `id`, in source order. */
  incoming(id: string): readonly GraphEdge[];
}

export interface BuildGraphOptions<TPose> {
  read?: DiagramNodeReader;
  geometry?: PoseProjection<TPose>;
}

/**
 * Read a graph out of a source of scene nodes.
 *
 * A node is an edge if it carries the edge trait and names exactly two
 * dependencies; a participant if the reader hands back a `DiagramNode`;
 * neither, and it is not in the diagram at all. An edge whose endpoints are not
 * both participants is dropped — a dangling edge should not be ranking
 * anything.
 */
export function buildGraph<TPose>(
  source: GraphSource<TPose>,
  opts: BuildGraphOptions<TPose> = {},
): Graph {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseProjection<TPose>);
  const nodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();
  const candidates: GraphEdge[] = [];

  for (const { node, pose } of source()) {
    if (diagramEdgeOf(node) !== null) {
      const deps = node.dependsOn;
      if (Array.isArray(deps) && deps.length === 2) {
        candidates.push({ id: node.id, from: deps[0]!, to: deps[1]! });
      }
      continue;
    }
    const trait = diagramNodeOf(node, opts.read);
    if (trait === null) continue;
    const entry: GraphNode = {
      id: node.id,
      bounds: geometry.getBounds(pose),
      pinned: trait.pinned === true,
    };
    nodes.push(entry);
    byId.set(entry.id, entry);
  }

  const edges = candidates.filter((e) => byId.has(e.from) && byId.has(e.to));
  const out = new Map<string, GraphEdge[]>();
  const into = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    push(out, edge.from, edge);
    push(into, edge.to, edge);
  }

  const NONE: readonly GraphEdge[] = Object.freeze([]);
  return {
    nodes,
    edges,
    node: (id) => byId.get(id),
    outgoing: (id) => out.get(id) ?? NONE,
    incoming: (id) => into.get(id) ?? NONE,
  };
}

function push(index: Map<string, GraphEdge[]>, key: string, edge: GraphEdge): void {
  const list = index.get(key);
  if (list === undefined) index.set(key, [edge]);
  else list.push(edge);
}
