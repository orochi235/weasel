/** Test fixture: a grouped graph, and where a layout leaves its boxes. */
import { buildGraph, type Graph, type GraphNodeLike } from './graph';
import type { LayoutOptions, LayoutResult } from './layout';

export interface Rect { x: number; y: number; width: number; height: number }

const DEGENERATE: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** Built through `buildGraph`, so groups are read the way a scene's are: a
 *  node whose trait carries `group`, depending on its members. */
export function graphOf(
  ids: readonly string[],
  edges: readonly (readonly [string, string])[],
  groups: Readonly<Record<string, readonly string[]>>,
  inset = 12,
): Graph {
  const entries: { node: GraphNodeLike; pose: Rect }[] = [];
  ids.forEach((id, i) => entries.push({
    node: { id, kind: 'leaf', data: { diagram: {} } },
    pose: { x: i, y: i, width: 100, height: 40 },
  }));
  for (const [id, members] of Object.entries(groups)) {
    entries.push({
      node: { id, kind: 'leaf', data: { diagram: { group: { inset } } }, dependsOn: members },
      pose: DEGENERATE,
    });
  }
  edges.forEach(([from, to], i) => entries.push({
    node: { id: `e${i}`, kind: 'leaf', data: { diagram: { from: {}, to: {} } }, dependsOn: [from, to] },
    pose: DEGENERATE,
  }));
  return buildGraph<Rect>(() => entries);
}

/** Every node where the layout put it. */
export function placed<O extends LayoutOptions>(
  graph: Graph,
  fn: (graph: Graph, opts?: O) => LayoutResult,
  opts?: O,
): Map<string, Rect> {
  const moved = fn(graph, opts);
  return new Map(graph.nodes.map((n) => [n.id, { ...n.bounds, ...(moved.get(n.id) ?? {}) }]));
}

/** A group's box the way the scene derives it: its members' union, grown by the inset. */
export function boxOf(at: Map<string, Rect>, members: readonly string[], inset: number): Rect {
  const rs = members.map((m) => at.get(m)!);
  const x = Math.min(...rs.map((r) => r.x)) - inset;
  const y = Math.min(...rs.map((r) => r.y)) - inset;
  return {
    x,
    y,
    width: Math.max(...rs.map((r) => r.x + r.width)) + inset - x,
    height: Math.max(...rs.map((r) => r.y + r.height)) + inset - y,
  };
}

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
