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
import { AUTO_POSE_DESCRIPTOR, type PoseDescriptor } from '@weasel-js/core/math';
import { expandGroupEdges, insetOf, type GroupInset } from './cluster';
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
  /** The group it belongs to, when it belongs to one. */
  group?: string;
}

/** A box drawn around some participants, which a layout keeps together and
 *  leaves room for. */
export interface GraphGroup {
  id: string;
  /** In source order. */
  members: readonly string[];
  /** Room the box keeps around its members, in world units. */
  inset: GroupInset;
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
  /** Absent or empty for a graph with no groups. */
  readonly groups?: readonly GraphGroup[];
  node(id: string): GraphNode | undefined;
  /** Edges leaving `id`, in source order. */
  outgoing(id: string): readonly GraphEdge[];
  /** Edges arriving at `id`, in source order. */
  incoming(id: string): readonly GraphEdge[];
}

/** Options for {@link buildGraph}: how the trait is read, and how a pose
 *  yields bounds. Both default to the kit's own. */
export interface BuildGraphOptions<TPose> {
  read?: DiagramNodeReader;
  geometry?: PoseDescriptor<TPose>;
}

/**
 * Read a graph out of a source of scene nodes.
 *
 * A node is an edge if it carries the edge trait and names exactly two
 * dependencies; a group if its trait carries `group`, with its dependencies as
 * its members; a participant if the reader hands back any other
 * `DiagramNode`; and otherwise not in the diagram at all. An edge whose
 * endpoints are not both participants or groups is dropped — a dangling edge
 * should not be ranking anything — and an edge to a group ranks against its
 * members (see `expandGroupEdges`).
 */
export function buildGraph<TPose>(
  source: GraphSource<TPose>,
  opts: BuildGraphOptions<TPose> = {},
): Graph {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const nodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();
  const candidates: GraphEdge[] = [];
  const groupNodes: { id: string; members: readonly string[]; inset: GroupInset }[] = [];

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
    if (trait.group !== undefined) {
      const deps = node.dependsOn;
      groupNodes.push({
        id: node.id,
        members: Array.isArray(deps) ? deps : [],
        inset: insetOf(trait.group.inset),
      });
      continue;
    }
    const entry: GraphNode = {
      id: node.id,
      bounds: geometry.getBounds(pose),
      pinned: trait.pinned === true,
    };
    nodes.push(entry);
    byId.set(entry.id, entry);
  }

  // A member is one only once: a node a second group also names stays in the first.
  const groups: GraphGroup[] = [];
  const claimed = new Set<string>();
  for (const g of groupNodes) {
    const members = g.members.filter((id) => byId.has(id) && !claimed.has(id));
    for (const id of members) {
      claimed.add(id);
      byId.get(id)!.group = g.id;
    }
    groups.push({ ...g, members });
  }
  const live = groups.filter((g) => g.members.length > 0);
  const known = (id: string) => byId.has(id) || live.some((g) => g.id === id);
  const edges = expandGroupEdges(candidates.filter((e) => known(e.from) && known(e.to)), live);
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
    groups: live,
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
