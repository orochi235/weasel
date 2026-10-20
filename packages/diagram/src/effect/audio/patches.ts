import type { GraphNodeDef, GraphPatch } from '@weasel-js/audio';
import { edgeKey, type LivePlan, type PlanEdge, type PlanNode } from './plan';

/** Makes the def for a node that is added or replaced. */
export type BuildNode = (id: string, node: PlanNode) => GraphNodeDef;

function sameSettings(a: PlanNode['settings'], b: PlanNode['settings']): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => k in b && Object.is(a[k], b[k]));
}

const touches = (e: PlanEdge, ids: ReadonlySet<string>): boolean =>
  ids.has(e.from) || ('node' in e.to && ids.has(e.to.node));

/** The patches that turn the graph `prev` describes into the one `next` describes. */
export function diffPlans(prev: LivePlan, next: LivePlan, build: BuildNode): GraphPatch[] {
  const prevIds = Object.keys(prev.nodes).sort();
  const nextIds = Object.keys(next.nodes).sort();
  const gone = new Set<string>(); // removed, or removed to change type: their old edges are dropped
  const fresh = new Set<string>(); // gone, or newly added: every edge touching them in `next` is connected
  const groups = {
    disconnect: [] as GraphPatch[],
    remove: [] as GraphPatch[],
    add: [] as GraphPatch[],
    replace: [] as GraphPatch[],
    set: [] as GraphPatch[],
    connect: [] as GraphPatch[],
  };

  for (const id of prevIds) {
    const now = next.nodes[id];
    if (now === undefined || now.type !== prev.nodes[id]!.type) {
      gone.add(id);
      fresh.add(id);
      groups.remove.push({ kind: 'remove', id });
    }
  }
  for (const id of nextIds) {
    const now = next.nodes[id]!;
    const was = prev.nodes[id];
    if (was === undefined || gone.has(id)) {
      fresh.add(id);
      groups.add.push({ kind: 'add', id, def: build(id, now) });
    } else if (!sameSettings(was.settings, now.settings)) {
      groups.replace.push({ kind: 'replace', id, def: build(id, now) });
    } else {
      for (const param of Object.keys(now.levels).sort()) {
        const value = now.levels[param]!;
        if (!Object.is(was.levels[param], value)) groups.set.push({ kind: 'set', id, param, value });
      }
    }
  }

  const nextKeys = new Set(next.edges.map(edgeKey));
  const prevKeys = new Set(prev.edges.map(edgeKey));
  for (const e of prev.edges) {
    if (!nextKeys.has(edgeKey(e)) && !touches(e, gone)) {
      groups.disconnect.push({ kind: 'disconnect', from: e.from, to: e.to });
    }
  }
  for (const e of next.edges) {
    if (!prevKeys.has(edgeKey(e)) || touches(e, fresh)) groups.connect.push({ kind: 'connect', from: e.from, to: e.to });
  }

  return [
    ...groups.disconnect,
    ...groups.remove,
    ...groups.add,
    ...groups.replace,
    ...groups.set,
    ...groups.connect,
  ];
}
