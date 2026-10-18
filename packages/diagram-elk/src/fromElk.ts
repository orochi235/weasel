/**
 * Reading a laid-out ELK graph back into the diagram's terms. The graph went
 * in asking for root coordinates (`elk.json.shapeCoords` and `edgeCoords`), so
 * every position read here is already in one frame, ELK's.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Bounds } from '@weasel-js/diagram/layout';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type { ElkIndex } from './toElk';

/** Everything ELK placed, keyed by the graph's ids, in ELK's frame. */
export interface ElkPlacement {
  /** Each participant's top-left. */
  nodes: Map<string, Vec2>;
  /** Each group's box. */
  groups: Map<string, Bounds>;
  /** Each drawn edge's route, end to end. */
  routes: Map<string, Vec2[]>;
  /** Each labeled edge's label box. */
  labels: Map<string, Bounds>;
}

export function fromElk(root: ElkNode, index: ElkIndex): ElkPlacement {
  const out: ElkPlacement = { nodes: new Map(), groups: new Map(), routes: new Map(), labels: new Map() };
  const edges: ElkExtendedEdge[] = [];
  const visit = (n: ElkNode) => {
    edges.push(...(n.edges ?? []));
    for (const child of n.children ?? []) {
      const x = child.x ?? 0;
      const y = child.y ?? 0;
      const node = index.nodes.get(child.id);
      if (node !== undefined) out.nodes.set(node.id, { x, y });
      const group = index.groups.get(child.id);
      if (group !== undefined) out.groups.set(group.id, { x, y, width: child.width ?? 0, height: child.height ?? 0 });
      visit(child);
    }
  };
  visit(root);

  for (const e of edges) {
    const drawn = index.edges.get(e.id);
    if (drawn === undefined) continue;
    const route: Vec2[] = [];
    for (const s of e.sections ?? []) route.push(s.startPoint, ...(s.bendPoints ?? []), s.endPoint);
    if (route.length > 0) out.routes.set(drawn.id, dedupe(route));
    const label = e.labels?.[0];
    if (label !== undefined && drawn.label !== undefined) {
      out.labels.set(drawn.id, { x: label.x ?? 0, y: label.y ?? 0, width: label.width ?? 0, height: label.height ?? 0 });
    }
  }
  return out;
}

/** A route with no point repeated back to back, as consecutive sections of
 *  one edge share their joining point. */
function dedupe(route: readonly Vec2[]): Vec2[] {
  return route.filter((p, i) => i === 0 || p.x !== route[i - 1]!.x || p.y !== route[i - 1]!.y);
}
