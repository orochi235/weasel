/**
 * Edges between two nodes level with each other along the rank axis.
 *
 * Ranking puts every edge's ends in different ranks, but a pin stays where its
 * author put it, so two ends can still finish side by side. Leaving by the
 * faces toward the next and last rank, such an edge would loop out and back
 * round; it runs straight across between their facing sides instead, or,
 * when a node sits between them, out past both on the side toward the next
 * rank and back.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Graph } from '../graph';
import type { Bounds } from '../outline';
import { center, extent, type LayoutAxes, type LayoutDirection, type LayoutPorts } from '../layout';
import { FACES, hasCompassPort, type Compass } from '../route';

/** What {@link levelRoutes} reads. */
export interface LevelInput {
  graph: Graph;
  /** Where each node finishes. */
  boxes: ReadonlyMap<string, Bounds>;
  axes: LayoutAxes;
  direction?: LayoutDirection;
  rankGap: number;
}

/** The ports, and the waypoints where it goes around, of each edge between
 *  two level nodes, keyed by the edge's id as drawn. */
export interface LevelRoutes {
  ports: Map<string, LayoutPorts>;
  waypoints: Map<string, Vec2[]>;
}

/** The compass faces toward low and high cross coordinates. */
const SIDES = { x: { low: 'w', high: 'e' }, y: { low: 'n', high: 's' } } as const;

interface Span {
  lo: number;
  hi: number;
}

const spanOf = (b: Bounds, axis: 'x' | 'y'): Span => {
  const lo = axis === 'x' ? b.x : b.y;
  return { lo, hi: lo + extent(b, axis) };
};
const overlaps = (p: Span, q: Span): boolean => p.lo < q.hi && q.lo < p.hi;

/** Routes for every edge between two nodes level along the rank axis and
 *  apart across it. */
export function levelRoutes(input: LevelInput): LevelRoutes {
  const { graph, boxes, axes } = input;
  const out: LevelRoutes = { ports: new Map(), waypoints: new Map() };
  const seen = new Set<string>();
  for (const e of graph.edges) {
    const id = e.origin?.id ?? e.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const from = e.origin?.from ?? e.from;
    const to = e.origin?.to ?? e.to;
    const a = boxes.get(from);
    const b = boxes.get(to);
    if (from === to || a === undefined || b === undefined) continue;
    if (!overlaps(spanOf(a, axes.rank), spanOf(b, axes.rank)) || overlaps(spanOf(a, axes.cross), spanOf(b, axes.cross))) continue;
    const others = [...boxes].filter(([n]) => n !== from && n !== to).map(([, box]) => box);
    if (between(a, b, others, axes)) {
      const face = FACES[input.direction ?? 'down'].out;
      out.ports.set(id, named(graph, [from, face], [to, face]));
      out.waypoints.set(id, around(a, b, others, axes, input.rankGap));
    } else {
      const sides = SIDES[axes.cross];
      const ahead = center(a, axes.cross) < center(b, axes.cross);
      out.ports.set(id, named(graph, [from, ahead ? sides.high : sides.low], [to, ahead ? sides.low : sides.high]));
    }
  }
  return out;
}

/** The ports each end has by the name given. */
function named(graph: Graph, [from, f]: [string, Compass], [to, t]: [string, Compass]): LayoutPorts {
  const has = (id: string, face: Compass) => {
    const node = graph.node(id);
    return node !== undefined && hasCompassPort(node, face);
  };
  return { ...(has(from, f) ? { from: f } : {}), ...(has(to, t) ? { to: t } : {}) };
}

/** Whether a box sits on the straight run from `a`'s facing side to `b`'s:
 *  across, the gap between them; along the rank axis, from one's middle to
 *  the other's. */
function between(a: Bounds, b: Bounds, others: readonly Bounds[], axes: LayoutAxes): boolean {
  const [ca, cb] = [spanOf(a, axes.cross), spanOf(b, axes.cross)];
  const gap = ca.hi <= cb.lo ? { lo: ca.hi, hi: cb.lo } : { lo: cb.hi, hi: ca.lo };
  const [ma, mb] = [center(a, axes.rank), center(b, axes.rank)];
  const run = { lo: Math.min(ma, mb), hi: Math.max(ma, mb) };
  return others.some((o) => {
    const r = spanOf(o, axes.rank);
    return overlaps(spanOf(o, axes.cross), gap) && r.lo <= run.hi && r.hi >= run.lo;
  });
}

/**
 * Two waypoints past whichever of `a` and `b` reaches further toward the next
 * rank, one beyond each one's middle: half `rankGap` out, or half way to the
 * nearest box beyond in the way of the run between them.
 */
function around(a: Bounds, b: Bounds, others: readonly Bounds[], axes: LayoutAxes, rankGap: number): Vec2[] {
  const ahead = (box: Bounds) => (axes.sign === 1 ? spanOf(box, axes.rank).hi : -spanOf(box, axes.rank).lo);
  const behind = (box: Bounds) => (axes.sign === 1 ? spanOf(box, axes.rank).lo : -spanOf(box, axes.rank).hi);
  const edge = Math.max(ahead(a), ahead(b));
  const [ma, mb] = [center(a, axes.cross), center(b, axes.cross)];
  const run = { lo: Math.min(ma, mb), hi: Math.max(ma, mb) };
  let standoff = rankGap / 2;
  for (const o of others) {
    const room = behind(o) - edge;
    const c = spanOf(o, axes.cross);
    if (room > 0 && c.lo <= run.hi && c.hi >= run.lo) standoff = Math.min(standoff, room / 2);
  }
  const rank = axes.sign * (edge + standoff);
  const point = (cross: number): Vec2 => (axes.cross === 'x' ? { x: cross, y: rank } : { x: rank, y: cross });
  return [point(ma), point(mb)];
}
