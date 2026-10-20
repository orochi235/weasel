/**
 * One leg of a route: A* over the crossings of the grid lines, on states that
 * carry a heading, so a turn costs `bendPenalty` and the heuristic can count
 * the turns still owed. The graph is never built: a step's blockage is asked
 * of the obstacle index as the search expands.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { gridLines } from './grid';
import { MinHeap } from './heap';
import type { EdgeObstacles } from './obstacles';
import type { SegmentIndex } from './segments';
import { DX, DY, minTurns, type Dir } from './turns';
import type { Box } from './types';

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

/** States a search may settle before it gives up on its window. */
const MAX_SETTLED = 200_000;

/** Index of the line in sorted `lines` nearest `v`. */
function nearest(lines: readonly number[], v: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]! < v) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && Math.abs(lines[lo - 1]! - v) < Math.abs(lines[lo]! - v) ? lo - 1 : lo;
}

/** The cheapest leg from any of `sources` to any of `targets` within the
 *  context's window, or null when there is none. */
export function searchLeg(sources: readonly LegSource[], targets: readonly LegTarget[], ctx: LegContext): LegResult | null {
  const { obstacles, bendPenalty } = ctx;
  const ends = [...sources.map((s) => s.point), ...targets.map((t) => t.point)];
  const { xs, ys } = gridLines(ctx.window, obstacles.near(ctx.window), ends);
  const ny = ys.length;
  const vertexOf = (p: Vec2) => nearest(xs, p.x) * ny + nearest(ys, p.y);
  const pointOf = (v: number): Vec2 => ({ x: xs[Math.floor(v / ny)]!, y: ys[v % ny]! });

  const goals = new Map<number, number[]>();
  targets.forEach((t, k) => {
    const v = vertexOf(t.point);
    goals.set(v, [...(goals.get(v) ?? []), k]);
  });
  const h = (v: number, d: Dir): number => {
    const p = pointOf(v);
    let best = Infinity;
    for (const t of targets) {
      const est = Math.abs(t.point.x - p.x) + Math.abs(t.point.y - p.y) + bendPenalty * minTurns(p, d, t.point, t.arrive);
      if (est < best) best = est;
    }
    return best;
  };

  const g = new Map<number, number>();
  const parent = new Map<number, number>();
  const origin = new Map<number, number>();
  const heap = new MinHeap();
  sources.forEach((s, k) => {
    const state = vertexOf(s.point) * 4 + s.heading;
    if ((g.get(state) ?? Infinity) <= 0) return;
    g.set(state, 0);
    origin.set(state, k);
    heap.push(state, h(state >> 2, s.heading), 0);
  });

  const settled = new Set<number>();
  while (heap.size > 0 && settled.size < MAX_SETTLED) {
    const state = heap.pop()!;
    if (settled.has(state)) continue;
    settled.add(state);
    const v = state >> 2;
    const d = (state & 3) as Dir;
    const at = goals.get(v);
    const hit = at?.find((k) => targets[k]!.arrive === null || targets[k]!.arrive === d);
    if (hit !== undefined) return finish(state, hit);
    const i = Math.floor(v / ny);
    const j = v % ny;
    const base = g.get(state)!;
    for (let nd = 0 as Dir; nd < 4; nd = (nd + 1) as Dir) {
      if (nd === ((d + 2) & 3)) continue;
      const ni = i + DX[nd];
      const nj = j + DY[nd];
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ny) continue;
      const x0 = xs[i]!;
      const y0 = ys[j]!;
      const x1 = xs[ni]!;
      const y1 = ys[nj]!;
      if (obstacles.crosses(x0, y0, x1, y1)) continue;
      let cost = base + Math.abs(x1 - x0) + Math.abs(y1 - y0) + (nd === d ? 0 : bendPenalty);
      if (ctx.crossings) cost += ctx.crossings.penalty * ctx.crossings.index.crossings(ctx.edge, x0, y0, x1, y1);
      const next = (ni * ny + nj) * 4 + nd;
      if (cost >= (g.get(next) ?? Infinity)) continue;
      g.set(next, cost);
      parent.set(next, state);
      const rest = h(next >> 2, nd);
      heap.push(next, cost + rest, rest);
    }
  }
  return null;

  function finish(goal: number, target: number): LegResult {
    const states: number[] = [goal];
    while (parent.has(states[states.length - 1]!)) states.push(parent.get(states[states.length - 1]!)!);
    states.reverse();
    const source = origin.get(states[0]!)!;
    const points: Vec2[] = [sources[source]!.point];
    for (let k = 1; k < states.length; k++) {
      const turnsHere = k + 1 < states.length && (states[k]! & 3) !== (states[k + 1]! & 3);
      if (turnsHere) points.push(pointOf(states[k]! >> 2));
    }
    points.push(targets[target]!.point);
    return { points, source, target, arrive: (goal & 3) as Dir, cost: g.get(goal)! };
  }
}
