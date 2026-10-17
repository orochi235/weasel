/**
 * A diagram `Graph` as an ELK graph: participants as leaf nodes, groups as
 * compound nodes nested the way the groups are, the ports an edge names as
 * fixed ports, and each drawn edge once.
 *
 * Every ELK id is minted here rather than reused from the graph, so nothing a
 * caller names can collide across ELK's one id space for nodes, ports, edges
 * and labels. `ElkIndex` maps them back.
 */
import type { Vec2 } from '@weasel-js/core/math';
import {
  DEFAULT_PORTS,
  portsOnOutline,
  type EdgeLabelRoom,
  type Graph,
  type GraphGroup,
  type GraphNode,
  type Port,
} from '@weasel-js/diagram/layout';
import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api';

/** One drawn edge: a stand-in `expandGroupEdges` made folds back into this. */
export interface DrawnEdge {
  id: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  label?: EdgeLabelRoom;
  authored: boolean;
}

/** ELK ids back to the graph's. */
export interface ElkIndex {
  nodes: Map<string, GraphNode>;
  groups: Map<string, GraphGroup>;
  edges: Map<string, DrawnEdge>;
}

/** Where each of a node's declared ports sits, cast onto its outline as
 *  `portsOf` casts them, for a node whose top-left is `at`. */
export function portPoints(node: GraphNode, at: Vec2): Port[] {
  const bounds = { x: at.x, y: at.y, width: node.bounds.width, height: node.bounds.height };
  const ports: Port[] = (node.ports ?? DEFAULT_PORTS).map((spec) => ({
    id: spec.id,
    nodeId: node.id,
    point: { x: at.x + spec.at.u * bounds.width, y: at.y + spec.at.v * bounds.height },
    normal: null,
  }));
  return node.outline === undefined ? ports : portsOnOutline(ports, node.outline, bounds);
}

/** Each drawn edge once, in graph order, naming only the ports its node ends
 *  declare: a group has none, and a port a node does not declare is no port. */
export function drawnEdges(graph: Graph): DrawnEdge[] {
  const declares = (id: string, port: string | undefined) => {
    const node = graph.node(id);
    return port !== undefined && node !== undefined && (node.ports ?? DEFAULT_PORTS).some((p) => p.id === port);
  };
  const seen = new Map<string, DrawnEdge>();
  for (const e of graph.edges) {
    const id = e.origin?.id ?? e.id;
    if (seen.has(id)) continue;
    const from = e.origin?.from ?? e.from;
    const to = e.origin?.to ?? e.to;
    seen.set(id, {
      id,
      from,
      to,
      ...(declares(from, e.fromPort) ? { fromPort: e.fromPort } : {}),
      ...(declares(to, e.toPort) ? { toPort: e.toPort } : {}),
      ...(e.label !== undefined ? { label: e.label } : {}),
      authored: e.authored === true,
    });
  }
  return [...seen.values()];
}

/** The ELK graph for `graph`, its root carrying `layoutOptions`. */
export function toElk(graph: Graph, layoutOptions: Record<string, string>): { root: ElkNode; index: ElkIndex } {
  const index: ElkIndex = { nodes: new Map(), groups: new Map(), edges: new Map() };
  const groups = graph.groups ?? [];
  const elkIdOf = new Map<string, string>();
  graph.nodes.forEach((n, i) => {
    elkIdOf.set(n.id, `n${i}`);
    index.nodes.set(`n${i}`, n);
  });
  groups.forEach((g, i) => {
    elkIdOf.set(g.id, `g${i}`);
    index.groups.set(`g${i}`, g);
  });

  const edges = drawnEdges(graph).filter((e) => elkIdOf.has(e.from) && elkIdOf.has(e.to));
  const named = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.fromPort !== undefined) addTo(named, e.from, e.fromPort);
    if (e.toPort !== undefined) addTo(named, e.to, e.toPort);
  }

  const leaves = new Map<string | undefined, ElkNode[]>();
  for (const n of graph.nodes) {
    pushTo(leaves, n.group, leafOf(n, elkIdOf.get(n.id)!, named.get(n.id)));
  }
  const transposed = minimumTransposed(layoutOptions);
  const boxOf = (g: GraphGroup): ElkNode => ({
    id: elkIdOf.get(g.id)!,
    layoutOptions: groupOptions(g, transposed),
    children: [...groups.filter((c) => c.parent === g.id).map(boxOf), ...(leaves.get(g.id) ?? [])],
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((e, i) => {
    index.edges.set(`e${i}`, e);
    const end = (id: string, port: string | undefined) =>
      port !== undefined ? portId(elkIdOf.get(id)!, port) : elkIdOf.get(id)!;
    return {
      id: `e${i}`,
      sources: [end(e.from, e.fromPort)],
      targets: [end(e.to, e.toPort)],
      // ELK leaves a label with no text at the origin, unplaced, in some
      // graphs; the text is never measured, since the size is given.
      ...(e.label !== undefined ? { labels: [{ id: `e${i}l`, text: e.id, width: e.label.width, height: e.label.height }] } : {}),
    };
  });

  const root: ElkNode = {
    id: 'root',
    layoutOptions,
    children: [...groups.filter((g) => g.parent === undefined).map(boxOf), ...(leaves.get(undefined) ?? [])],
    edges: elkEdges,
  };
  return { root, index };
}

function leafOf(node: GraphNode, id: string, ports: ReadonlySet<string> | undefined): ElkNode {
  const leaf: ElkNode = { id, width: node.bounds.width, height: node.bounds.height };
  if (ports === undefined) return leaf;
  const elkPorts: ElkPort[] = portPoints(node, { x: 0, y: 0 })
    .filter((p) => ports.has(p.id))
    .map((p) => ({ id: portId(id, p.id), x: p.point.x, y: p.point.y, width: 0, height: 0 }));
  return { ...leaf, ports: elkPorts, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } };
}

function groupOptions(g: GraphGroup, transposed: boolean): Record<string, string> {
  const { top, right, bottom, left } = g.inset;
  const options: Record<string, string> = { 'elk.padding': `[top=${top},left=${left},bottom=${bottom},right=${right}]` };
  if (g.minWidth !== undefined) {
    options['elk.nodeSize.constraints'] = 'MINIMUM_SIZE';
    options['elk.nodeSize.minimum'] = transposed ? `(0, ${g.minWidth})` : `(${g.minWidth}, 0)`;
  }
  return options;
}

/** Whether elkjs 0.12 reads a compound node's minimum size with its axes
 *  swapped, as it does laying out every level at once with ranks running
 *  up or down. */
export function minimumTransposed(options: Readonly<Record<string, string>>): boolean {
  const read = (key: string) => options[`elk.${key}`] ?? options[`org.eclipse.elk.${key}`];
  const direction = read('direction');
  return read('hierarchyHandling') === 'INCLUDE_CHILDREN' && (direction === 'DOWN' || direction === 'UP');
}

function portId(nodeElkId: string, port: string): string {
  return `${nodeElkId}:${port}`;
}

function addTo(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key);
  if (set === undefined) map.set(key, new Set([value]));
  else set.add(value);
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}
