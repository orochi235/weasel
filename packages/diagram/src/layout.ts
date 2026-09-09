/**
 * Layout: where the participants go.
 *
 * A layout is a pure function of the graph — no scene, no ops, no history. It
 * hands back the new top-left for every node that **moves**, and a node already
 * standing where the layout wants it is simply absent from the answer. That is
 * what makes re-running a layout free rather than destructive, and it is the
 * property the idempotence test asserts.
 *
 * Three rules keep re-layout non-destructive, and all three live here rather
 * than in each algorithm:
 *
 *   - **No RNG anywhere.** Every tiebreak falls back to the graph's own node
 *     order, which is the source's order — render order, for a scene.
 *   - **Within-rank order is seeded from where the nodes already are**, read
 *     off the cross axis, rather than from crossing-minimization. An author who
 *     dragged two boxes into an order gets that order back.
 *   - **A pin set nothing moves.** Pinned nodes are never in the result, and
 *     the rest of the layout is translated to sit around them.
 *
 * `layered` and `tree` are idempotent by construction: the second run reads the
 * order the first run produced and computes the same slots. `force` is an
 * iterative relaxation and makes no such claim — re-running it keeps relaxing.
 */
import type { Vec2 } from '@weasel-js/core';
import type { Graph, GraphNode } from './graph';
import type { Bounds } from './outline';

/** Which way the ranks stack. `force` ignores it. */
export type LayoutDirection = 'down' | 'up' | 'right' | 'left';

export interface LayoutOptions {
  /** Default `'down'`. */
  direction?: LayoutDirection;
  /** Between neighbors within a rank, in world units. Default 48. */
  nodeGap?: number;
  /** Between one rank and the next. Default 96. */
  rankGap?: number;
  /** Ids layout must not move, on top of whatever carries `pinned: true`. */
  pin?: Iterable<string>;
  /** How far a node has to move to be worth moving, in world units. Default
   *  `1e-6` — a float-noise floor, not a snapping quantum. Raise it to let a
   *  `force` pass that has stopped doing anything useful commit nothing. */
  tolerance?: number;
}

/** The new top-left for each node that moves. A node that is already there is
 *  absent, so an empty result means "nothing to do". */
export type LayoutResult = ReadonlyMap<string, Vec2>;

/** Every layout in this package has this shape, and so does a consumer's. */
export type LayoutFn = (graph: Graph, opts?: LayoutOptions) => LayoutResult;

export const DEFAULT_NODE_GAP = 48;
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
 * Turn canonical slots into the positions to write.
 *
 * Three steps, in order: map the canonical frame onto the world axes the
 * direction names; translate the whole layout so it lands where the graph
 * already is; drop everything that is pinned or that would not move.
 *
 * The translation is what makes the layout non-destructive, and it is chosen so
 * that a second run lands on the same answer. With a pin, it is whatever keeps
 * the first pinned node exactly where it is. Without one, it is whatever puts
 * the layout's own bounding box where the graph's bounding box already starts —
 * which the first run then makes true, so the second run computes the same
 * translation and writes nothing.
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
    const along = axes.sign === 1 ? slot.rank : -(slot.rank + extent(node.bounds, axes.rank));
    placed.set(
      node.id,
      axes.rank === 'y' ? { x: slot.cross, y: along } : { x: along, y: slot.cross },
    );
  }

  return translated(graph, placed, pinned, tolerance);
}

/**
 * {@link settle}'s second half, for a layout that already works in world
 * coordinates — `force` does, since the integrator moves points around rather
 * than filling slots.
 */
export function translated(
  graph: Graph,
  placed: ReadonlyMap<string, Vec2>,
  pinned: ReadonlySet<string>,
  tolerance = DEFAULT_TOLERANCE,
): LayoutResult {
  const anchor = anchorDelta(graph, placed, pinned);
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

function anchorDelta(
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
 *
 * Shared by `layered`'s ranks and `tree`'s sibling rows, which pack a row the
 * same way and differ only in what decides the order.
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
