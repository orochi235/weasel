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
import type { GroupInset } from './cluster';
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

/** `bounds` grown by `margin`: what a node takes up, labels and all. Layout
 *  spaces nodes by it, and a group's box is fitted around it. */
export function grownBy(bounds: Bounds, margin: GroupInset | undefined): Bounds {
  if (margin === undefined) return bounds;
  return {
    x: bounds.x - margin.left,
    y: bounds.y - margin.top,
    width: bounds.width + margin.left + margin.right,
    height: bounds.height + margin.top + margin.bottom,
  };
}

/** `node` as layout sees it: bounds grown by its margin, ports where they were. */
export function footprintNode(node: GraphNode): GraphNode {
  const m = node.margin;
  if (m === undefined) return node;
  const b = node.bounds;
  const bounds = grownBy(b, m);
  const specs = node.ports ?? DEFAULT_PORTS;
  const trait = { ports: specs, ...(node.outline !== undefined ? { outline: node.outline } : {}) };
  const ports = specs.map((spec): PortSpec => {
    const [at, ...sites] = portSitesOf({ id: node.id, kind: 'mark', data: null }, b, spec.id, { read: () => trait });
    if (at === undefined) return spec;
    return {
      ...spec,
      at: anchorIn(bounds, at.point),
      normal: at.normal,
      ...(spec.sites !== undefined ? { sites: sites.map((s) => ({ ...anchorIn(bounds, s.point), normal: s.normal })) } : {}),
    };
  });
  const { outline: _o, margin: _m, ...kept } = node;
  return { ...kept, bounds, ports };
}

/** Run `plan` over `graph` with every node at its footprint, and hand back
 *  moves for the nodes' own boxes, now or once `plan` answers. */
export function planWithMargins(graph: Graph, plan: (graph: Graph) => LayoutPlan): LayoutPlan;
export function planWithMargins(
  graph: Graph,
  plan: (graph: Graph) => LayoutPlan | Promise<LayoutPlan>,
): LayoutPlan | Promise<LayoutPlan>;
export function planWithMargins(
  graph: Graph,
  plan: (graph: Graph) => LayoutPlan | Promise<LayoutPlan>,
): LayoutPlan | Promise<LayoutPlan> {
  if (!graph.nodes.some((n) => n.margin !== undefined)) return plan(graph);
  const nodes = graph.nodes.map(footprintNode);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const back = (out: LayoutPlan): LayoutPlan => {
    const moves = new Map<string, Vec2>();
    for (const [id, at] of out.moves) {
      const m = graph.node(id)?.margin;
      moves.set(id, m === undefined ? at : { x: at.x + m.left, y: at.y + m.top });
    }
    return { ...out, moves };
  };
  const out = plan({ ...graph, nodes, node: (id) => byId.get(id) });
  return isPromise(out) ? out.then(back) : back(out);
}

/** Whether `answer` is still to come. A thenable test, not `instanceof`: a
 *  promise from another realm is no instance of this one's `Promise`. */
export const isPromise = <T>(answer: T | Promise<T>): answer is Promise<T> =>
  typeof (answer as { then?: unknown } | null)?.then === 'function';
