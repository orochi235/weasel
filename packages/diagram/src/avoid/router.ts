/**
 * The incremental router: it holds the obstacles it last committed and the
 * routes it last made, and each update reroutes only what changed.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { samePoints } from '../edgeTrait';
import { changedObstacles, dirtyEdges, fullRoute, stopsKey } from './dirty';
import { DragIndex } from './dragIndex';
import { routeEdge } from './edgeRoute';
import { nudge, type NudgeRoute } from './nudge';
import { ObstacleIndex } from './obstacles';
import { SegmentIndex } from './segments';
import { AVOID_DEFAULTS, type AvoidEdge, type AvoidInput, type AvoidObstacle, type AvoidOptions, type Box } from './types';

/** How one {@link AvoidRouter.update} runs. */
export interface AvoidUpdateOptions {
  /** A drag frame: route against the committed obstacles without replacing
   *  them, with no crossing penalty and no nudging. */
  preview?: boolean;
  /** Milliseconds a preview may spend. The connectors it does not reach keep
   *  the route the last preview gave them. Default no limit. */
  budgetMs?: number;
}

/** Each rerouted connector's new route, the bends between its ends, or null
 *  where no path was found and the connector falls back to `orthogonal`. */
export type AvoidRoutes = Map<string, Vec2[] | null>;

/** An obstacle-avoiding router that remembers what it last routed. */
export interface AvoidRouter {
  /** Take `input` as already routed: its obstacles as committed and each
   *  connector's `route` as its own, routing nothing. */
  seed(input: AvoidInput): void;
  /** Reroute what changed since the last commit, and commit `input` unless
   *  this is a preview. Answers only the connectors it rerouted, or moved
   *  while spreading a channel they share. */
  update(input: AvoidInput, opts?: AvoidUpdateOptions): AvoidRoutes;
}

const now = (): number => globalThis.performance?.now() ?? Date.now();

/** The box every search window may grow to: everything, with room around it. */
function limitOf(input: AvoidInput, margin: number): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const take = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const { box } of input.obstacles) {
    take(box.x, box.y);
    take(box.x + box.width, box.y + box.height);
  }
  for (const e of input.edges) {
    for (const p of [...e.from.ports, ...e.to.ports]) take(p.point.x, p.point.y);
    for (const w of e.waypoints ?? []) take(w.x, w.y);
  }
  if (x0 === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: x0 - 2 * margin, y: y0 - 2 * margin, width: x1 - x0 + 4 * margin, height: y1 - y0 + 4 * margin };
}

/** A router with `options` over the defaults. */
export function createAvoidRouter(options: AvoidOptions = {}): AvoidRouter {
  const opts = { ...AVOID_DEFAULTS, ...options };
  let committed = new Map<string, AvoidObstacle>();
  const keys = new Map<string, string>();
  /** Each connector's last route with its ends, as it was before nudging and after. */
  const raw = new Map<string, Vec2[]>();
  const shown = new Map<string, Vec2[]>();
  const previews = new Map<string, Vec2[] | null>();
  let drag: DragIndex | null = null;
  /** Where each connector sat in the last committed input, to find a dirty one in a frame without a scan. */
  let positions = new Map<string, number>();

  /** The route `edge` holds now, with its ends. */
  const routeOf = (edge: AvoidEdge): Vec2[] => {
    const mine = shown.get(edge.id);
    return mine !== undefined && edge.route !== undefined && samePoints(mine.slice(1, -1), edge.route) ? mine : fullRoute(edge);
  };
  const rawOf = (edge: AvoidEdge): Vec2[] => {
    const mine = shown.get(edge.id);
    return mine !== undefined && raw.has(edge.id) && edge.route !== undefined && samePoints(mine.slice(1, -1), edge.route)
      ? raw.get(edge.id)! : routeOf(edge);
  };

  function forget(input: AvoidInput): void {
    const live = new Set(input.edges.map((e) => e.id));
    for (const map of [keys, raw, shown]) for (const id of [...map.keys()]) if (!live.has(id)) map.delete(id);
  }

  /** Index what `input`, as committed, holds now, for the drag frames that follow. */
  function indexForDrag(input: AvoidInput): void {
    const routes = new Map(input.edges.map((e) => [e.id, routeOf(e)]));
    drag = new DragIndex(input, routes, opts.clearance, limitOf(input, opts.margin));
    positions = new Map(input.edges.map((e, k) => [e.id, k]));
  }

  /** Connector `id` of `edges`, found where it sat at the last commit when it is still there. */
  const edgeIn = (edges: readonly AvoidEdge[], id: string): AvoidEdge | undefined => {
    const at = positions.get(id);
    return at !== undefined && edges[at]?.id === id ? edges[at] : edges.find((e) => e.id === id);
  };

  function preview(input: AvoidInput, budgetMs: number): AvoidRoutes {
    const start = now();
    if (drag === null) indexForDrag({ obstacles: [...committed.values()], edges: input.edges });
    const frame = drag!.frame(input.obstacles);
    const out: AvoidRoutes = new Map();
    for (const id of frame.dirty) {
      if (now() - start > budgetMs) {
        const last = previews.get(id);
        if (last !== undefined) out.set(id, last);
        continue;
      }
      const edge = edgeIn(input.edges, id);
      if (edge === undefined) continue;
      const full = routeEdge(edge, { index: frame.index, options: opts, limit: frame.limit });
      const route = full === null ? null : full.slice(1, -1);
      previews.set(id, route);
      out.set(id, route);
    }
    return out;
  }

  function commit(input: AvoidInput, dirty: AvoidEdge[]): AvoidRoutes {
    previews.clear();
    const index = new ObstacleIndex(input.obstacles, opts.clearance);
    const limit = limitOf(input, opts.margin);
    const dirtyIds = new Set(dirty.map((e) => e.id));
    const crossings = new SegmentIndex();
    const clean = new SegmentIndex();
    for (const e of input.edges) {
      if (dirtyIds.has(e.id)) continue;
      crossings.add(e.id, routeOf(e));
      clean.add(e.id, rawOf(e));
    }
    const fresh = new Map<string, Vec2[] | null>();
    for (const edge of dirty) {
      const full = routeEdge(edge, { index, options: opts, limit, crossings });
      fresh.set(edge.id, full);
      if (full !== null) crossings.add(edge.id, full);
      keys.set(edge.id, stopsKey(edge));
    }
    const byId = new Map(input.edges.map((e) => [e.id, e]));
    const bundle = bundleOf(fresh, input.edges, clean, rawOf);
    const nudged = nudge(bundle, opts.spacing, index);
    const out: AvoidRoutes = new Map();
    for (const [id, full] of fresh) if (full === null) { raw.delete(id); shown.delete(id); out.set(id, null); }
    for (const [id, full] of nudged) {
      const was = dirtyIds.has(id) ? null : routeOf(byId.get(id)!);
      raw.set(id, bundle.get(id)!.points);
      shown.set(id, full);
      if (was === null || !samePoints(was, full)) out.set(id, full.slice(1, -1));
    }
    indexForDrag({ obstacles: input.obstacles, edges: input.edges.map((e) => withRoute(e, out)) });
    return out;
  }

  return {
    seed(input) {
      committed = new Map(input.obstacles.map((o) => [o.id, o]));
      keys.clear();
      raw.clear();
      shown.clear();
      for (const e of input.edges) keys.set(e.id, stopsKey(e));
      previews.clear();
      indexForDrag(input);
    },
    update(input, updateOpts = {}) {
      if (updateOpts.preview === true) return preview(input, updateOpts.budgetMs ?? Infinity);
      const changed = changedObstacles(committed, input.obstacles);
      const dirty = dirtyEdges(input.edges, keys, changed, opts.clearance, routeOf);
      committed = new Map(input.obstacles.map((o) => [o.id, o]));
      forget(input);
      return commit(input, dirty);
    },
  };
}

/** The routes to nudge: each one just made, and each clean one whose
 *  segments `clean` finds meeting theirs, as it was before nudging. */
function bundleOf(
  fresh: ReadonlyMap<string, Vec2[] | null>,
  edges: readonly AvoidEdge[],
  clean: SegmentIndex,
  rawOf: (edge: AvoidEdge) => Vec2[],
): Map<string, NudgeRoute> {
  const bundle = new Map<string, NudgeRoute>();
  const mates = new Set<string>();
  const waypoints = new Map(edges.map((e) => [e.id, e.waypoints ?? []]));
  for (const [id, full] of fresh) {
    if (full === null) continue;
    bundle.set(id, { points: full, waypoints: waypoints.get(id)! });
    for (let i = 1; i + 2 < full.length; i++) clean.edgesMeeting(segmentBox(full[i]!, full[i + 1]!), mates);
  }
  for (const e of edges) {
    if (mates.has(e.id) && !fresh.has(e.id)) bundle.set(e.id, { points: rawOf(e), waypoints: e.waypoints ?? [] });
  }
  return bundle;
}

/** `edge` holding the route `routes` gave it, when they gave it one. */
function withRoute(edge: AvoidEdge, routes: AvoidRoutes): AvoidEdge {
  const route = routes.get(edge.id);
  if (route === undefined) return edge;
  const { route: _r, ...rest } = edge;
  return route === null ? rest : { ...rest, route };
}

/** A segment's box, its thickness zero. */
const segmentBox = (a: Vec2, b: Vec2): Box => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y),
});
