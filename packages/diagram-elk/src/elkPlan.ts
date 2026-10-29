/**
 * The adapter: lay a diagram's `Graph` out with ELK and answer with a
 * `LayoutPlan`, so the result goes through `applyLayout` and `routesOf` like
 * any of the diagram package's own layouts.
 *
 * ELK answers asynchronously, so this is not a `LayoutFn`. It is a
 * `LayoutPlanner` instead, through `elkPlanner`: a live run, and so
 * `DiagramView.layout`, asks it once and eases to its answer.
 */
import type { Vec2 } from '@weasel-js/core/math';
import {
  anchorOffset,
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  pinnedSet,
  translated,
  type Bounds,
  type Graph,
  type LayoutDirection,
  type LayoutOptions,
  type LayoutPlan,
  type LayoutPlanner,
  type LayoutPorts,
  type LayoutResult,
} from '@weasel-js/diagram/layout';
import { nearestOnLine } from '@weasel-js/geom';
import type { ELK } from 'elkjs/lib/elk-api';
import { fromElk, type ElkPlacement } from './fromElk';
import { drawnEdges, portPoints, toElk, type DrawnEdge } from './toElk';

/** Anything with ELK's `layout`: the bundled instance, or one on a worker. */
export type ElkRunner = Pick<ELK, 'layout'>;

/** {@link elkPlan}'s options: the diagram's own, read as ELK's nearest
 *  equivalents, and a way through to everything else ELK takes. */
export interface ElkLayoutOptions extends Omit<LayoutOptions, 'order' | 'chain' | 'chainSide'> {
  /** The ELK to run on. Default: elkjs's bundled build, loaded on first use
   *  and run on the calling thread. Pass one built on `elk-worker` to keep a
   *  large layout off it. */
  elk?: ElkRunner;
  /** ELK options for the root, applied over the ones this derives from the
   *  rest, under their full or `elk.`-prefixed ids. Default algorithm
   *  `elk.layered`. */
  layoutOptions?: Record<string, string>;
}

/** {@link elkPlan}'s answer: a layout plan, and what else ELK placed. */
export interface ElkPlan extends LayoutPlan {
  /** Each group's box, in world coordinates. The diagram derives a box from
   *  its members, so nothing writes these; they are what ELK left room for. */
  groups: ReadonlyMap<string, Bounds>;
  /** Each routed edge end to end, keyed by the edge as drawn. `waypoints` is
   *  the same route without its two ends. */
  routes: ReadonlyMap<string, readonly Vec2[]>;
  /** Pinned nodes ELK put somewhere else. Only the first pin holds: the
   *  layout is translated onto it, and ELK has no way to be told the rest. */
  unheld: ReadonlySet<string>;
}

const DIRECTIONS: Record<LayoutDirection, string> = { down: 'DOWN', up: 'UP', right: 'RIGHT', left: 'LEFT' };

/** The ELK options a run starts from, before `opts.layoutOptions`. */
export function rootOptions(opts: ElkLayoutOptions = {}): Record<string, string> {
  const spacing = String(opts.nodeGap ?? DEFAULT_NODE_GAP);
  return {
    'elk.algorithm': 'layered',
    'elk.direction': DIRECTIONS[opts.direction ?? 'down'],
    'elk.spacing.nodeNode': spacing,
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.rankGap ?? DEFAULT_RANK_GAP),
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.json.shapeCoords': 'ROOT',
    'elk.json.edgeCoords': 'ROOT',
    ...opts.layoutOptions,
  };
}

let bundled: Promise<ElkRunner> | undefined;

/** elkjs's bundled build, imported the first time a layout needs it. */
function defaultElk(): Promise<ElkRunner> {
  bundled ??= import('elkjs/lib/elk.bundled.js').then(({ default: ELKConstructor }) => new ELKConstructor());
  return bundled;
}

/** Lay `graph` out with ELK: where each participant goes, each edge's route
 *  and the port at either end, each label's place, and each group's box. */
export async function elkPlan(graph: Graph, opts: ElkLayoutOptions = {}): Promise<ElkPlan> {
  const { root, index } = toElk(graph, rootOptions(opts));
  const elk = opts.elk ?? (await defaultElk());
  const placement = fromElk(await elk.layout(root), index);
  return planFrom(graph, placement, opts);
}

/** {@link elkPlan}'s moves alone. */
export async function elkLayout(graph: Graph, opts: ElkLayoutOptions = {}): Promise<LayoutResult> {
  return (await elkPlan(graph, opts)).moves;
}

/** {@link elkPlanner}'s answer: a `LayoutPlanner` whose plan is an {@link ElkPlan}. */
export interface ElkPlanner extends LayoutPlanner {
  plan(graph: Graph, opts?: LayoutOptions): Promise<ElkPlan>;
}

/** ELK as a `LayoutPlanner`, for a live run or `DiagramView.layout`: `opts`
 *  over whatever layout options the run passes. */
export function elkPlanner(opts: ElkLayoutOptions = {}): ElkPlanner {
  return { plan: (graph, layout) => elkPlan(graph, { ...layout, ...opts }) };
}

function planFrom(graph: Graph, placed: ElkPlacement, opts: ElkLayoutOptions): ElkPlan {
  const pinned = pinnedSet(graph, opts);
  const tolerance = opts.tolerance ?? 1e-6;
  const d = anchorOffset(graph, placed.nodes, pinned);
  const shift = (p: Vec2): Vec2 => ({ x: p.x + d.x, y: p.y + d.y });

  const unheld = new Set<string>();
  for (const node of graph.nodes) {
    const at = placed.nodes.get(node.id);
    if (!pinned.has(node.id) || at === undefined) continue;
    const to = shift(at);
    if (Math.abs(to.x - node.bounds.x) > tolerance || Math.abs(to.y - node.bounds.y) > tolerance) unheld.add(node.id);
  }

  const groups = new Map<string, Bounds>();
  for (const [id, box] of placed.groups) groups.set(id, { ...box, ...shift(box) });

  const routes = new Map<string, Vec2[]>();
  const waypoints = new Map<string, Vec2[]>();
  const labels = new Map<string, Vec2>();
  const ports = new Map<string, LayoutPorts>();
  for (const edge of drawnEdges(graph)) {
    const elkRoute = placed.routes.get(edge.id);
    if (edge.authored || elkRoute === undefined || elkRoute.length < 2) continue;
    const route = elkRoute.map(shift);
    routes.set(edge.id, route);
    if (route.length > 2) waypoints.set(edge.id, route.slice(1, -1));
    const box = placed.labels.get(edge.id);
    if (box !== undefined) labels.set(edge.id, nearestOnRoute(route, shift({ x: box.x + box.width / 2, y: box.y + box.height / 2 })));
    const named = endPorts(graph, edge, route, placed, shift);
    if (named.from !== undefined || named.to !== undefined) ports.set(edge.id, named);
  }

  return {
    moves: translated(graph, placed.nodes, pinned, tolerance),
    waypoints,
    labels,
    ports,
    groups,
    routes,
    unheld,
  };
}

/** The port an edge leaves and arrives by: the one it names, or else the
 *  declared port nearest where ELK met the node, among those on the face it
 *  met when there are any. Nearest overall can sit on another face of a wide
 *  box, and the wire then runs across the box to reach it. A group end has
 *  none. */
function endPorts(
  graph: Graph,
  edge: DrawnEdge,
  route: readonly Vec2[],
  placed: ElkPlacement,
  shift: (p: Vec2) => Vec2,
): LayoutPorts {
  const nearest = (id: string, point: Vec2): string | undefined => {
    const node = graph.node(id);
    const at = placed.nodes.get(id);
    if (node === undefined || at === undefined) return undefined;
    const box = { ...shift(at), width: node.bounds.width, height: node.bounds.height };
    const ports = portPoints(node, shift(at));
    const met = faceOf(box, point);
    const onFace = ports.filter((p) => faceOf(box, p.point) === met);
    let best: string | undefined;
    let bestDist = Infinity;
    for (const port of onFace.length > 0 ? onFace : ports) {
      const dist = Math.hypot(port.point.x - point.x, port.point.y - point.y);
      if (dist < bestDist) [best, bestDist] = [port.id, dist];
    }
    return best;
  };
  const from = edge.fromPort ?? nearest(edge.from, route[0]!);
  const to = edge.toPort ?? nearest(edge.to, route.at(-1)!);
  return { ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) };
}

/** The side of `box` nearest `p`. */
function faceOf(box: Bounds, p: Vec2): 'top' | 'right' | 'bottom' | 'left' {
  const sides = [
    ['top', Math.abs(p.y - box.y)],
    ['right', Math.abs(p.x - box.x - box.width)],
    ['bottom', Math.abs(p.y - box.y - box.height)],
    ['left', Math.abs(p.x - box.x)],
  ] as const;
  return sides.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

function nearestOnRoute(route: readonly Vec2[], probe: Vec2): Vec2 {
  let best = route[0]!;
  let bestDist = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    const hit = nearestOnLine(probe.x, probe.y, a.x, a.y, b.x, b.y);
    if (hit.dist < bestDist) [best, bestDist] = [{ x: hit.x, y: hit.y }, hit.dist];
  }
  return best;
}
