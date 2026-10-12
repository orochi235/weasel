import { forceCenter, forceCollide, forceLink, forceManyBody } from 'd3-force';
import type { SimulationForce, SimulationNode } from '@weasel-js/simulation';

export interface GraphNode extends SimulationNode {
  id: string;
  group: number;
}
export interface GraphLink {
  source: GraphNode | number | string;
  target: GraphNode | number | string;
}

/** One graph the demo can build: how big, and the forces that keep that many
 *  nodes inside roughly the same canvas. */
export interface GraphSize {
  count: number;
  links: number;
  /** Node radius, world px. */
  radius: number;
  charge: number;
  linkDistance: number;
}

/** The last is past what a diagram with a scene node per edge is sized for,
 *  which is the case the simulation loop and an edge layer exist for. */
export const GRAPH_SIZES: readonly GraphSize[] = [
  { count: 24, links: 30, radius: 8, charge: -80, linkDistance: 60 },
  { count: 400, links: 500, radius: 4, charge: -30, linkDistance: 24 },
  { count: 2000, links: 2500, radius: 2.5, charge: -12, linkDistance: 12 },
];

export const GROUP_COUNT = 5;

/** A random graph of `size`, scattered around the middle of `bounds`. */
export function makeGraph(
  size: GraphSize,
  bounds: { width: number; height: number },
  random: () => number = Math.random,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const spread = Math.min(bounds.width, bounds.height) / 2;
  const nodes: GraphNode[] = [];
  for (let i = 0; i < size.count; i++) {
    nodes.push({
      id: `n${i}`,
      group: i % GROUP_COUNT,
      x: bounds.width / 2 + (random() - 0.5) * spread,
      y: bounds.height / 2 + (random() - 0.5) * spread,
    });
  }
  const seen = new Set<number>();
  const links: GraphLink[] = [];
  while (links.length < size.links) {
    const a = Math.floor(random() * size.count);
    const b = Math.floor(random() * size.count);
    if (a === b) continue;
    const key = Math.min(a, b) * size.count + Math.max(a, b);
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: nodes[a].id, target: nodes[b].id });
  }
  return { nodes, links };
}

/** d3-force's own forces for a graph of `size`. `forceLink` resolves each
 *  link's ids to node objects in place, which is what the edge layer reads. */
export function graphForces(
  size: GraphSize,
  links: GraphLink[],
  bounds: { width: number; height: number },
): SimulationForce<GraphNode>[] {
  return [
    forceManyBody<GraphNode>().strength(size.charge),
    forceLink<GraphNode, GraphLink>(links).id((n) => n.id).distance(size.linkDistance).strength(0.5),
    forceCollide<GraphNode>(size.radius + 2),
    forceCenter<GraphNode>(bounds.width / 2, bounds.height / 2),
  ];
}
