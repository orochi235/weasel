/**
 * One leg of a route: A* over the sparse visibility graph of the leg's window,
 * on states that carry a heading, so a turn costs `bendPenalty` and the
 * heuristic can count the turns still owed. States are expanded lazily; a
 * step's crossings of other routes are asked of their spatial hash when the
 * search first takes it.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { interestingPoints } from './grid';
import { MinHeap } from './heap';
import type { EdgeObstacles } from './obstacles';
import type { SegmentIndex } from './segments';
import { minTurns, type Dir } from './turns';
import type { Box } from './types';
import { StateTable } from './stateTable';
import { visibilityGraph, type VisibilityGraph } from './visibility';

/** Where a leg may start: a point, and the heading it leaves with. */
export interface LegSource {
  point: Vec2;
  heading: Dir;
}

/** Where a leg may end: a point, and the heading it must arrive with. */
export interface LegTarget {
  point: Vec2;
  arrive: Dir | null;
}

/** What one leg search reads besides its ends. */
export interface LegContext {
  edge: string;
  obstacles: EdgeObstacles;
  window: Box;
  bendPenalty: number;
  /** Other connectors' routes, and what crossing one costs; absent, crossings are free. */
  crossings?: { index: SegmentIndex; penalty: number } | undefined;
}

/** A leg found: its bends from start to end, and which source and target it used. */
export interface LegResult {
  points: Vec2[];
  source: number;
  target: number;
  arrive: Dir;
  cost: number;
}

/** What a leg search answers when no window could hold a path: an end sits
 *  inside an obstacle, or obstacles wall it in. */
export const ENCLOSED = 'enclosed';

/** Whether the part of `graph` reachable from `starts` stays clear of the
 *  window's edge, so no larger window would reach anything new from it. */
function sealed(graph: VisibilityGraph, starts: readonly number[]): boolean {
  const seen = new Set(starts);
  const queue = [...starts];
  while (queue.length > 0) {
    const v = queue.pop()!;
    if (graph.open(v)) return false;
    for (let d = 0; d < 4; d++) {
      const w = graph.neighbor(v, d);
      if (w >= 0 && !seen.has(w)) {
        seen.add(w);
        queue.push(w);
      }
    }
  }
  return true;
}


/** States a search may settle before it gives up. A larger window would
 *  only settle more, so giving up here ends the route. */
const MAX_SETTLED = 50_000;

/** Shared by every search: they run one at a time. */
const TABLE = new StateTable();

/** The cheapest leg from any of `sources` to any of `targets` within the
 *  context's window; null when there is none in it, and {@link ENCLOSED} when
 *  there is none in any window. */
export function searchLeg(
  sources: readonly LegSource[],
  targets: readonly LegTarget[],
  ctx: LegContext,
): LegResult | typeof ENCLOSED | null {
  const { bendPenalty } = ctx;
  const ends = [...sources.map((s) => s.point), ...targets.map((t) => t.point)];
  const boxes = ctx.obstacles.near(ctx.window);
  const graph = visibilityGraph(interestingPoints(ctx.window, boxes, ends), boxes, ctx.window);

  const goals = new Map<number, number[]>();
  targets.forEach((t, k) => {
    const v = graph.at(t.point);
    if (v >= 0) goals.set(v, [...(goals.get(v) ?? []), k]);
  });
  if (goals.size === 0) return ENCLOSED;
  const h = (v: number, d: Dir): number => {
    const p = { x: graph.x(v), y: graph.y(v) };
    let best = Infinity;
    for (const t of targets) {
      const est = Math.abs(t.point.x - p.x) + Math.abs(t.point.y - p.y) + bendPenalty * minTurns(p, d, t.point, t.arrive);
      if (est < best) best = est;
    }
    return best;
  };

  const table = TABLE;
  table.reset();
  const origin = new Map<number, number>();
  const heap = new MinHeap();
  sources.forEach((s, k) => {
    const v = graph.at(s.point);
    const state = v * 4 + s.heading;
    if (v < 0) return;
    table.ensure(graph.size() * 4);
    if (table.cost(state) <= 0) return;
    table.reach(state, 0, -1);
    origin.set(state, k);
    heap.push(state, h(v, s.heading), 0);
  });
  const starts = [...origin.keys()].map((s) => s >> 2);
  if (starts.length === 0) return ENCLOSED;

  // A step's cost does not depend on the heading it is taken from.
  const stepCost = (v: number, w: number, key: number): number => {
    let cost = table.stepCost(key);
    if (!Number.isNaN(cost)) return cost;
    const x0 = graph.x(v);
    const y0 = graph.y(v);
    const x1 = graph.x(w);
    const y1 = graph.y(w);
    cost = Math.abs(x1 - x0) + Math.abs(y1 - y0)
      + (ctx.crossings ? ctx.crossings.penalty * ctx.crossings.index.crossings(ctx.edge, x0, y0, x1, y1) : 0);
    table.rememberStep(key, cost);
    return cost;
  };

  let settled = 0;
  while (heap.size > 0) {
    if (settled >= MAX_SETTLED) return ENCLOSED;
    const state = heap.pop()!;
    if (table.done(state)) continue;
    table.settle(state);
    settled++;
    const v = state >> 2;
    const d = (state & 3) as Dir;
    const hit = goals.get(v)?.find((k) => targets[k]!.arrive === null || targets[k]!.arrive === d);
    if (hit !== undefined) return finish(state, hit);
    const base = table.cost(state);
    for (let nd = 0 as Dir; nd < 4; nd = (nd + 1) as Dir) {
      if (nd === ((d + 2) & 3)) continue;
      const w = graph.neighbor(v, nd);
      if (w < 0) continue;
      table.ensure(graph.size() * 4);
      const cost = base + stepCost(v, w, v * 4 + nd) + (nd === d ? 0 : bendPenalty);
      const to = w * 4 + nd;
      if (cost >= table.cost(to)) continue;
      table.reach(to, cost, state);
      const rest = h(w, nd);
      heap.push(to, cost + rest, rest);
    }
  }
  if (sealed(graph, starts) || sealed(graph, [...goals.keys()])) return ENCLOSED;
  return null;

  function finish(goal: number, target: number): LegResult {
    const states: number[] = [goal];
    while (table.parent(states[states.length - 1]!) >= 0) states.push(table.parent(states[states.length - 1]!));
    states.reverse();
    const source = origin.get(states[0]!)!;
    const points: Vec2[] = [sources[source]!.point];
    for (let k = 1; k < states.length; k++) {
      const turnsHere = k + 1 < states.length && (states[k]! & 3) !== (states[k + 1]! & 3);
      if (turnsHere) points.push({ x: graph.x(states[k]! >> 2), y: graph.y(states[k]! >> 2) });
    }
    points.push(targets[target]!.point);
    return { points, source, target, arrive: (goal & 3) as Dir, cost: table.cost(goal) };
  }
}
