import { closesCycle, duplicateNode, noNode, noParam, noPort, owns } from './errors';
import type { GraphNodeDef, GraphPatch, GraphTarget } from './types';

/** What a caller can see of a live node: its port names and its params. */
export interface ViewNode {
  readonly ports: ReadonlySet<string>;
  readonly params: object;
}

/** A connection the caller can see, open or deferred, by id. `to` null is the output. */
export interface ViewEdge {
  readonly from: string;
  readonly to: string | null;
  readonly port: string;
}

export interface GraphView {
  readonly nodes: ReadonlyMap<string, ViewNode>;
  readonly edges: readonly ViewEdge[];
}

export const viewNode = (def: GraphNodeDef): ViewNode => ({
  ports: new Set(Object.keys(def.inputs)),
  params: def.params,
});

const toId = (to: GraphTarget): string | null => ('output' in to ? null : to.node);
const toPort = (to: GraphTarget): string => ('output' in to ? '' : to.port);

/**
 * Throw the error the first structurally wrong patch would, applying each to a
 * copy of `view` in order, so a list that would fail partway changes nothing.
 */
export function validatePatches(view: GraphView, patches: readonly GraphPatch[]): void {
  const nodes = new Map(view.nodes);
  let edges = [...view.edges];
  const live = (id: string): ViewNode => {
    const n = nodes.get(id);
    if (!n) throw noNode(id);
    return n;
  };
  const reaches = (start: string, goal: string): boolean => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === goal) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const e of edges) if (e.from === id && e.to !== null) stack.push(e.to);
    }
    return false;
  };
  const same = (e: ViewEdge, from: string, to: GraphTarget): boolean =>
    e.from === from && e.to === toId(to) && e.port === toPort(to);

  for (const p of patches) {
    switch (p.kind) {
      case 'add':
        if (nodes.has(p.id)) throw duplicateNode(p.id);
        nodes.set(p.id, viewNode(p.def));
        break;
      case 'remove':
        if (nodes.delete(p.id)) edges = edges.filter((e) => e.from !== p.id && e.to !== p.id);
        break;
      case 'replace': {
        live(p.id);
        const n = viewNode(p.def);
        nodes.set(p.id, n);
        edges = edges.filter((e) => e.to !== p.id || n.ports.has(e.port));
        break;
      }
      case 'connect': {
        live(p.from);
        const to = toId(p.to);
        if (to !== null && !live(to).ports.has(toPort(p.to))) throw noPort(to, toPort(p.to));
        if (edges.some((e) => same(e, p.from, p.to))) break;
        if (to !== null && reaches(to, p.from)) throw closesCycle(p.from, to);
        edges.push({ from: p.from, to, port: toPort(p.to) });
        break;
      }
      case 'disconnect':
        edges = edges.filter((e) => !same(e, p.from, p.to));
        break;
      case 'set':
        if (!owns(live(p.id).params, p.param)) throw noParam(p.id, p.param);
        break;
    }
  }
}
