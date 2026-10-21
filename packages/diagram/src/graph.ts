/**
 * `Graph` — the adjacency index a layout runs over.
 *
 * Built from the scene on demand, used, and thrown away. Rebuilding per layout
 * invocation is deliberate — a maintained index is a cache to invalidate on
 * every add, delete, reparent, and `dependsOn` edit, and layout is not on the
 * hot path.
 */
import { AUTO_POSE_DESCRIPTOR, type PoseDescriptor, type Vec2 } from '@weasel-js/core/math';
import { expandGroupEdges, insetOf, type GroupInset } from './cluster';
import { diagramEdgeOf, layoutOwnsRoute } from './edgeTrait';
import { nestGroups } from './groupTree';
import { diagramLabelOf, type DiagramLabel } from './labelTrait';
import type { Bounds, Outline } from './outline';
import { diagramNodeOf, type DiagramNodeLike, type DiagramNodeReader } from './trait';
import type { PortSpec } from './types';

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
  /** The innermost group it belongs to, when it belongs to one. */
  group?: string;
  /** Where its ports sit. Absent, the four compass midpoints
   *  (`DEFAULT_PORTS`). */
  ports?: readonly PortSpec[];
  /** The shape its ports are cast onto, as `portsOf` casts them. Absent,
   *  its bounds. */
  outline?: Outline;
  /** How far past `bounds` it reaches (`DiagramNode.margin`). `planOf` lays
   *  it out as that much bigger. */
  margin?: GroupInset;
}

/** A box drawn around some participants, which a layout keeps together and
 *  leaves room for. */
export interface GraphGroup {
  id: string;
  /** Every participant inside, through any group nested in this one, in
   *  source order. */
  members: readonly string[];
  /** Room the box keeps around what it holds, in world units. */
  inset: GroupInset;
  /** The narrowest its box may be across the world x axis, which a layout
   *  leaves room for. */
  minWidth?: number;
  /** The group this one is directly inside. */
  parent?: string;
  /** Its direct members, nodes and groups, in the order a layered layout
   *  keeps them across every rank: set for a group that reorders. */
  ordered?: readonly string[];
}

/** One connection. `id` is the edge node's own id, so a caller can go back to
 *  the scene for its trait. */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** The port it leaves `from` by, when it names one. */
  fromPort?: string;
  /** The port it arrives at `to` by, when it names one. */
  toPort?: string;
  /** Room its label needs: the label's box, and how far its near side sits
   *  from the wire (`DiagramLabel.offset`). `layered` sets the label beside
   *  its wire in a rank of its own. */
  label?: EdgeLabelRoom;
  /** Where its route runs now, from `from` to `to`. `layered` starts each
   *  placeholder where the route already crosses that rank, so a re-run keeps
   *  the order the last one settled on. */
  waypoints?: readonly Vec2[];
  /** Its route is someone's own: layout leaves it, and keeps no room for it
   *  in the ranks it crosses. */
  authored?: boolean;
  /** The edge as drawn, when this one stands in for an edge to or from a
   *  group (see `expandGroupEdges`). */
  origin?: { id: string; from: string; to: string };
}

/** The room a {@link GraphEdge}'s label takes, in world units. */
export interface EdgeLabelRoom {
  width: number;
  height: number;
  /** Between the wire and the label's near side, to the left of the
   *  direction of travel; negative for the right. Default 0, which centers
   *  the label on the wire. */
  offset?: number;
}

/**
 * Nodes, edges, and the two adjacency reads a layout needs.
 *
 * Every list is in source order — render order, when the source is a scene —
 * which is what a layout's tiebreaks resolve against.
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
 * its members, which may be groups themselves (see `nestGroups`); a participant if the reader hands back any other
 * `DiagramNode`; and otherwise not in the diagram at all. An edge whose
 * endpoints are not both participants or groups is dropped, and an edge to a
 * group ranks against its members (see `expandGroupEdges`).
 */
export function buildGraph<TPose>(
  source: GraphSource<TPose>,
  opts: BuildGraphOptions<TPose> = {},
): Graph {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const nodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();
  const candidates: GraphEdge[] = [];
  const groupNodes: { id: string; members: readonly string[]; inset: GroupInset; minWidth?: number; reorders?: boolean }[] = [];
  const routed = new Set<string>();
  const rooms = new Map<string, EdgeLabelRoom>();

  for (const { node, pose } of source()) {
    const edge = diagramEdgeOf(node);
    if (edge !== null) {
      const deps = node.dependsOn;
      if (Array.isArray(deps) && deps.length === 2) {
        candidates.push({
          id: node.id,
          from: deps[0]!,
          to: deps[1]!,
          ...(edge.from.port !== undefined ? { fromPort: edge.from.port } : {}),
          ...(edge.to.port !== undefined ? { toPort: edge.to.port } : {}),
          ...(edge.waypoints !== undefined && edge.waypoints.length > 0 ? { waypoints: edge.waypoints } : {}),
          ...(layoutOwnsRoute(edge) ? {} : { authored: true }),
        });
        if (layoutOwnsRoute(edge)) routed.add(node.id);
      }
      continue;
    }
    const label = diagramLabelOf(node);
    if (label !== null) {
      const deps = node.dependsOn;
      if (Array.isArray(deps) && deps.length === 1 && labelFollowsLayout(label.at) && !rooms.has(deps[0]!)) {
        const { width, height } = geometry.getBounds(pose);
        rooms.set(deps[0]!, { width, height, ...(label.offset ? { offset: label.offset } : {}) });
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
        ...(trait.group.minWidth !== undefined ? { minWidth: trait.group.minWidth } : {}),
        ...(trait.group.reorder !== undefined ? { reorders: true } : {}),
      });
      continue;
    }
    const entry: GraphNode = {
      id: node.id,
      bounds: geometry.getBounds(pose),
      pinned: trait.pinned === true,
      ...(trait.ports !== undefined ? { ports: trait.ports } : {}),
      ...(trait.outline !== undefined ? { outline: trait.outline } : {}),
      ...(trait.margin !== undefined ? { margin: trait.margin } : {}),
    };
    nodes.push(entry);
    byId.set(entry.id, entry);
  }

  const declared = new Map(groupNodes.map((g) => [g.id, g]));
  const live: GraphGroup[] = nestGroups(groupNodes, (id) => byId.has(id)).map((g) => {
    for (const id of g.direct) {
      const node = byId.get(id);
      if (node !== undefined) node.group = g.id;
    }
    return {
      id: g.id,
      members: g.members,
      inset: declared.get(g.id)!.inset,
      ...(declared.get(g.id)!.minWidth !== undefined ? { minWidth: declared.get(g.id)!.minWidth } : {}),
      ...(g.parent !== undefined ? { parent: g.parent } : {}),
      ...(declared.get(g.id)!.reorders === true ? { ordered: g.direct } : {}),
    };
  });
  const known = (id: string) => byId.has(id) || live.some((g) => g.id === id);
  // Room beside layout's own route only: an author's waypoints say where the
  // wire goes, and the label goes with it.
  const roomed = candidates.map((e) => {
    const room = rooms.get(e.id);
    return room !== undefined && routed.has(e.id) ? { ...e, label: room } : e;
  });
  return graphOf(nodes, expandGroupEdges(roomed.filter((e) => known(e.from) && known(e.to)), live), live);
}

const NONE: readonly GraphEdge[] = Object.freeze([]);

/** The graph over `nodes`, `edges`, and `groups`, indexed for lookup. */
export function graphOf(nodes: GraphNode[], edges: GraphEdge[], groups: GraphGroup[] = []): Graph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, GraphEdge[]>();
  const into = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    push(out, edge.from, edge);
    push(into, edge.to, edge);
  }
  return {
    nodes,
    edges,
    groups,
    node: (id) => byId.get(id),
    outgoing: (id) => out.get(id) ?? NONE,
    incoming: (id) => into.get(id) ?? NONE,
  };
}

/** Whether layout stations a label stationed at `at`: the default middle, or a
 *  place among its edge's waypoints, which only layout hands out. A label put
 *  at an end or a fraction stays there. */
export function labelFollowsLayout(at: DiagramLabel['at']): boolean {
  return at === 'mid' || typeof at === 'object';
}

function push(index: Map<string, GraphEdge[]>, key: string, edge: GraphEdge): void {
  const list = index.get(key);
  if (list === undefined) index.set(key, [edge]);
  else list.push(edge);
}
