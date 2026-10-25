/** Graphs for layout tests, built the way a scene builds one. */
import { buildGraph, type Graph, type GraphNodeLike } from './graph';
import type { LayoutResult } from './layout';

interface Rect { x: number; y: number; width: number; height: number }
export type Box = readonly [x: number, y: number, width?: number, height?: number];

const DEGENERATE: Rect = { x: 0, y: 0, width: 0, height: 0 };

/** A graph built the way a scene builds one — through `buildGraph`, so the
 *  layouts are exercised against the real index rather than a stand-in. */
export function graphOf(
  boxes: Readonly<Record<string, Box>>,
  edges: readonly (readonly [string, string])[] = [],
  pins: readonly string[] = [],
): Graph {
  const entries: { node: GraphNodeLike; pose: Rect }[] = [];
  for (const [id, [x, y, width = 100, height = 40]] of Object.entries(boxes)) {
    entries.push({
      node: { id, kind: 'mark', data: { diagram: pins.includes(id) ? { pinned: true } : {} } },
      pose: { x, y, width, height },
    });
  }
  edges.forEach(([from, to], i) => {
    entries.push({
      node: {
        id: `e${i}`,
        kind: 'mark',
        data: { diagram: { from: {}, to: {} } },
        dependsOn: [from, to],
      },
      pose: DEGENERATE,
    });
  });
  return buildGraph<Rect>(() => entries);
}

/** Where a node ends up: the layout's answer, or where it already was — a node
 *  that does not move is absent from the result, which is the whole point. */
export function at(boxes: Readonly<Record<string, Box>>, result: LayoutResult, id: string): { x: number; y: number } {
  const moveTo = result.get(id);
  if (moveTo !== undefined) return moveTo;
  const [x, y] = boxes[id]!;
  return { x, y };
}

/** The boxes a result leaves behind — what a second run reads. */
export function moved(boxes: Readonly<Record<string, Box>>, result: LayoutResult): Record<string, Box> {
  const next: Record<string, Box> = {};
  for (const [id, [x, y, w = 100, h = 40]] of Object.entries(boxes)) {
    const at = result.get(id);
    next[id] = at === undefined ? [x, y, w, h] : [at.x, at.y, w, h];
  }
  return next;
}
