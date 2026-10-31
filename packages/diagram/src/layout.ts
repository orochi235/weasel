/**
 * Layout: where the participants go.
 *
 * A layout is a pure function of the graph — no scene, no ops, no history. It
 * hands back the new top-left for every node that **moves**, and a node already
 * standing where the layout wants it is absent from the answer.
 *
 * Three rules keep re-layout non-destructive:
 *
 *   - **No RNG anywhere.** Every tiebreak falls back to the graph's own node
 *     order.
 *   - **Within-rank order is seeded from where the nodes already are**, read
 *     off the cross axis, rather than from crossing-minimization.
 *   - **A pin set nothing moves.** Pinned nodes are never in the result, and
 *     the rest of the layout is translated to sit around them.
 *
 * `layered` and `tree` are idempotent; `force` is an iterative relaxation and
 * re-running it keeps relaxing.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { planWithMargins } from './footprint';
import type { Graph, GraphNode } from './graph';
import type { Bounds } from './outline';

/** Which way the ranks stack. `force` ignores it. */
export type LayoutDirection = 'down' | 'up' | 'right' | 'left';

/** Options every layout takes. */
export interface LayoutOptions {
  /** Default `'down'`. */
  direction?: LayoutDirection;
  /** Between neighbors within a rank, in world units. Default 48. */
  nodeGap?: number;
  /** Between one rank and the next. Default 96. */
  rankGap?: number;
  /** How `layered` orders nodes within a rank. `'seeded'` (default) keeps
   *  the order they already sit in, an edge's place included: where its
   *  route crosses the rank now. `'barycenter'` reorders to reduce edge
   *  crossings, for a generated diagram with no arranged order to keep.
   *  Other layouts ignore it. */
  order?: 'seeded' | 'barycenter';
  /** Ids layout must not move, on top of whatever carries `pinned: true`. */
  pin?: Iterable<string>;
  /** How far a node has to move to be worth moving, in world units. Default
   *  `1e-6` — a float-noise floor, not a snapping quantum. Raise it to let a
   *  `force` pass that has stopped doing anything useful commit nothing. */
  tolerance?: number;
  /** `chain` only: the ids that stand on the line, in order. Unset, the
   *  longest path through the graph. */
  chain?: readonly string[];
  /** `chain` only: which side of the line everything else hangs on, along
   *  the cross axis. Default `'after'`. */
  chainSide?: 'after' | 'before';
  /** `tree` only: `'both'` splits each root's children between the two sides
   *  of it along the rank axis, as a mind map spreads, the halves as near
   *  equal in size as order allows; groups then are kept but not packed apart.
   *  Default `'one'`, every child past its parent. */
  treeSides?: 'one' | 'both';
}

/** The new top-left for each node that moves. A node that is already there is
 *  absent, so an empty result means "nothing to do". */
export type LayoutResult = ReadonlyMap<string, Vec2>;

/** A layout's answer with the edge routes it laid out, keyed by edge id. */
export interface LayoutPlan {
  moves: LayoutResult;
  /** For each edge layout routed: the points it runs through, from its
   *  `from` end to its `to` end. An edge absent runs straight between its
   *  ends. Absent altogether, the layout routes nothing. */
  waypoints?: ReadonlyMap<string, readonly Vec2[]>;
  /** For each edge layout left label room beside: the point on its route
   *  the room is beside, as a `DiagramLabel`'s `{ near }`. */
  labels?: ReadonlyMap<string, Vec2>;
  /** For each edge layout named ports for: the port it leaves `from` by and
   *  the one it arrives at `to` by, either absent where layout names none.
   *  Absent altogether, the layout names no ports. */
  ports?: ReadonlyMap<string, LayoutPorts>;
}

/** The ports a layout names for one edge. */
export interface LayoutPorts {
  from?: string;
  to?: string;
}

/** Every layout in this package has this shape, and so does a consumer's.
 *  One that routes edges as well says so with `plan`. */
export interface LayoutFn {
  (graph: Graph, opts?: LayoutOptions): LayoutResult;
  readonly plan?: (graph: Graph, opts?: LayoutOptions) => LayoutPlan;
}

/** A layout that answers with a whole plan, now or later: ELK's, say, or one
 *  computed on a server. A live run asks it once, with the graph it will ease
 *  from, and eases to the answer the way it eases to `layered`'s. */
export interface LayoutPlanner {
  plan(graph: Graph, opts?: LayoutOptions): LayoutPlan | Promise<LayoutPlan>;
}

/** A layout's plan: its own `plan`, or its moves alone. A node with a
 *  `margin` is laid out as its footprint, so neighbors keep clear of it. */
export function planOf(layout: LayoutFn, graph: Graph, opts?: LayoutOptions): LayoutPlan {
  return planWithMargins(graph, (g) => (layout.plan !== undefined ? layout.plan(g, opts) : { moves: layout(g, opts) }));
}

/** `planner`'s plan for `graph`, laid out by footprint the way {@link planOf}'s is. */
export function plannerPlan(planner: LayoutPlanner, graph: Graph, opts?: LayoutOptions): LayoutPlan | Promise<LayoutPlan> {
  return planWithMargins(graph, (g) => planner.plan(g, opts));
}

/** `LayoutOptions.nodeGap`'s default, in world units. */
export const DEFAULT_NODE_GAP = 48;
/** `LayoutOptions.rankGap`'s default, in world units. */
export const DEFAULT_RANK_GAP = 96;
const DEFAULT_TOLERANCE = 1e-6;

/** Which world axis carries ranks, which carries within-rank order, and
 *  whether ranks grow toward positive world coordinates. */
export interface LayoutAxes {
  rank: 'x' | 'y';
  cross: 'x' | 'y';
  /** `-1` for `'up'` and `'left'`, where the canonical frame is mirrored. */
  sign: 1 | -1;
}

/** The axes a direction lays ranks along. Default `'down'`. */
export function axesFor(direction: LayoutDirection = 'down'): LayoutAxes {
  switch (direction) {
    case 'up':
      return { rank: 'y', cross: 'x', sign: -1 };
    case 'right':
      return { rank: 'x', cross: 'y', sign: 1 };
    case 'left':
      return { rank: 'x', cross: 'y', sign: -1 };
    default:
      return { rank: 'y', cross: 'x', sign: 1 };
  }
}

/** A node's extent along one axis. */
export function extent(bounds: Bounds, axis: 'x' | 'y'): number {
  return axis === 'x' ? bounds.width : bounds.height;
}

/** A node's center along one axis — what within-rank order is seeded from. */
export function center(bounds: Bounds, axis: 'x' | 'y'): number {
  return axis === 'x' ? bounds.x + bounds.width / 2 : bounds.y + bounds.height / 2;
}

/** Every id layout must leave alone. */
export function pinnedSet(graph: Graph, opts: LayoutOptions = {}): Set<string> {
  const pinned = new Set<string>(opts.pin ?? []);
  for (const node of graph.nodes) {
    if (node.pinned) pinned.add(node.id);
  }
  return pinned;
}

/**
 * A placement in the canonical `(cross, rank)` frame, before it is turned into
 * world coordinates. `cross` and `rank` are the node's low corner along each.
 */
export interface Slot {
  cross: number;
  rank: number;
}

/**
 * Turn canonical slots into the positions to write: map the canonical frame
 * onto the world axes, translate the whole layout so it lands where the graph
 * already is, and drop everything that is pinned or that would not move.
 *
 * With a pin, the translation keeps the first pinned node exactly where it is.
 * Without one, it puts the layout's bounding box where the graph's already
 * starts, so a second run computes the same translation and writes nothing.
 */
export function settle(
  graph: Graph,
  slots: ReadonlyMap<string, Slot>,
  opts: LayoutOptions = {},
): LayoutResult {
  const axes = axesFor(opts.direction);
  const pinned = pinnedSet(graph, opts);
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;

  const placed = new Map<string, Vec2>();
  for (const node of graph.nodes) {
    const slot = slots.get(node.id);
    if (slot === undefined) continue;
    placed.set(node.id, worldOf(slot, extent(node.bounds, axes.rank), axes));
  }

  return translated(graph, placed, pinned, tolerance);
}

/** A slot's top-left in world coordinates, before {@link settle}'s
 *  translation, for something `depth` deep along the rank axis. */
export function worldOf(slot: Slot, depth: number, axes: LayoutAxes): Vec2 {
  const along = axes.sign === 1 ? slot.rank : -(slot.rank + depth);
  return axes.rank === 'y' ? { x: slot.cross, y: along } : { x: along, y: slot.cross };
}

/**
 * Run `once` until a pass moves nothing, and answer with where that leaves
 * each node.
 *
 * A layout that keeps groups together can move an outsider out of a group's
 * column, which changes the order the next run would start from. `passes`
 * bounds an arrangement that never comes to rest.
 */
export function untilSettled(
  once: LayoutFn,
  graph: Graph,
  opts: LayoutOptions = {},
  passes = 8,
): LayoutResult {
  const first = once(graph, opts);
  if (first.size === 0) return first;
  const at = new Map<string, Vec2>(first);
  for (let pass = 1; pass < passes; pass++) {
    const nodes = graph.nodes.map((node) => {
      const to = at.get(node.id);
      return to === undefined ? node : { ...node, bounds: { ...node.bounds, x: to.x, y: to.y } };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const next = once({ ...graph, nodes, node: (id) => byId.get(id) }, opts);
    if (next.size === 0) break;
    for (const [id, to] of next) at.set(id, to);
  }
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;
  const out = new Map<string, Vec2>();
  for (const node of graph.nodes) {
    const to = at.get(node.id);
    if (to === undefined) continue;
    if (Math.abs(to.x - node.bounds.x) <= tolerance && Math.abs(to.y - node.bounds.y) <= tolerance) continue;
    out.set(node.id, to);
  }
  return out;
}

/**
 * {@link settle}'s second half, for a layout that already works in world
 * coordinates.
 */
export function translated(
  graph: Graph,
  placed: ReadonlyMap<string, Vec2>,
  pinned: ReadonlySet<string>,
  tolerance = DEFAULT_TOLERANCE,
): LayoutResult {
  const anchor = anchorOffset(graph, placed, pinned);
  const out = new Map<string, Vec2>();
  for (const node of graph.nodes) {
    const at = placed.get(node.id);
    if (at === undefined || pinned.has(node.id)) continue;
    const x = at.x + anchor.x;
    const y = at.y + anchor.y;
    if (Math.abs(x - node.bounds.x) <= tolerance && Math.abs(y - node.bounds.y) <= tolerance) {
      continue;
    }
    out.set(node.id, { x, y });
  }
  return out;
}

/** How far {@link translated} moves a placement: onto the first pinned node,
 *  or else so its low corner lands on the graph's current one. */
export function anchorOffset(
  graph: Graph,
  placed: ReadonlyMap<string, Vec2>,
  pinned: ReadonlySet<string>,
): Vec2 {
  for (const node of graph.nodes) {
    if (!pinned.has(node.id)) continue;
    const at = placed.get(node.id);
    if (at !== undefined) return { x: node.bounds.x - at.x, y: node.bounds.y - at.y };
  }
  let minCurX = Infinity;
  let minCurY = Infinity;
  let minNewX = Infinity;
  let minNewY = Infinity;
  for (const node of graph.nodes) {
    const at = placed.get(node.id);
    if (at === undefined) continue;
    minCurX = Math.min(minCurX, node.bounds.x);
    minCurY = Math.min(minCurY, node.bounds.y);
    minNewX = Math.min(minNewX, at.x);
    minNewY = Math.min(minNewY, at.y);
  }
  if (!Number.isFinite(minCurX)) return { x: 0, y: 0 };
  return { x: minCurX - minNewX, y: minCurY - minNewY };
}

/**
 * Lay a list of nodes out along the cross axis, in the order given, and hand
 * back each one's low corner plus the total span.
 */
export function packAcross(
  nodes: readonly GraphNode[],
  axis: 'x' | 'y',
  gap: number,
): { at: Map<string, number>; span: number } {
  const at = new Map<string, number>();
  let cursor = 0;
  for (const node of nodes) {
    at.set(node.id, cursor);
    cursor += extent(node.bounds, axis) + gap;
  }
  return { at, span: nodes.length === 0 ? 0 : cursor - gap };
}

/** Order within a rank: where the nodes already sit on the cross axis, with
 *  graph order breaking a tie. Never a comparison that could reverse between
 *  two runs on the same input. */
export function seededOrder(
  nodes: readonly GraphNode[],
  axis: 'x' | 'y',
  indexOf: (id: string) => number,
): GraphNode[] {
  return [...nodes].sort((a, b) => {
    const d = center(a.bounds, axis) - center(b.bounds, axis);
    return d !== 0 ? d : indexOf(a.id) - indexOf(b.id);
  });
}

/** Each node's position in `graph.nodes`, for tiebreaks. */
export function graphOrder(graph: Graph): (id: string) => number {
  const index = new Map<string, number>();
  graph.nodes.forEach((node, i) => index.set(node.id, i));
  return (id) => index.get(id) ?? Number.MAX_SAFE_INTEGER;
}
