/**
 * Laying a node out as its footprint: its bounds grown by its `margin`.
 *
 * Every layout reads `GraphNode.bounds` for spacing, so rather than teach each
 * one about margins, `planOf` hands it nodes whose bounds already include
 * them, and moves the answer back to the boxes' own top-lefts. Ports are cast
 * onto the real box first and re-anchored in the footprint, so a router sees
 * every port where it really is.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Graph, GraphNode } from './graph';
import type { LayoutPlan } from './layout';
import type { Bounds } from './outline';
import { DEFAULT_PORTS, portSitesOf } from './ports';
import type { PortAnchor, PortSpec } from './types';

function anchorIn(box: Bounds, p: Vec2): PortAnchor {
  return {
    u: box.width > 0 ? (p.x - box.x) / box.width : 0.5,
    v: box.height > 0 ? (p.y - box.y) / box.height : 0.5,
  };
}

/** `node` as layout sees it: bounds grown by its margin, ports where they were. */
export function footprintNode(node: GraphNode): GraphNode {
  const m = node.margin;
  if (m === undefined) return node;
  const b = node.bounds;
  const bounds = { x: b.x - m.left, y: b.y - m.top, width: b.width + m.left + m.right, height: b.height + m.top + m.bottom };
  const specs = node.ports ?? DEFAULT_PORTS;
  const trait = { ports: specs, ...(node.outline !== undefined ? { outline: node.outline } : {}) };
  const ports = specs.map((spec): PortSpec => {
    const [at, ...sites] = portSitesOf({ id: node.id, kind: 'leaf', data: null }, b, spec.id, { read: () => trait });
    if (at === undefined) return spec;
    return {
      ...spec,
      at: anchorIn(bounds, at.point),
      normal: at.normal,
      ...(spec.sites !== undefined ? { sites: sites.map((s) => anchorIn(bounds, s.point)) } : {}),
    };
  });
  const { outline: _o, margin: _m, ...kept } = node;
  return { ...kept, bounds, ports };
}

/** Run `plan` over `graph` with every node at its footprint, and hand back
 *  moves for the nodes' own boxes. */
export function planWithMargins(graph: Graph, plan: (graph: Graph) => LayoutPlan): LayoutPlan {
  if (!graph.nodes.some((n) => n.margin !== undefined)) return plan(graph);
  const nodes = graph.nodes.map(footprintNode);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = plan({ ...graph, nodes, node: (id) => byId.get(id) });
  const moves = new Map<string, Vec2>();
  for (const [id, at] of out.moves) {
    const m = graph.node(id)?.margin;
    moves.set(id, m === undefined ? at : { x: at.x + m.left, y: at.y + m.top });
  }
  return { ...out, moves };
}
