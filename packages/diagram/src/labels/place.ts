/**
 * Label placement as arithmetic: shapes, routes, and labels in, the station
 * each moving label settles at out. A label that something covers slides
 * along its own route, or flips to the other side of it, to the nearest
 * clear spot.
 */
import { polylineFromPoints, type Path, type Vec2 } from '@weasel-js/core/math';
import { nearestOnLine } from '@weasel-js/geom';
import { SpatialHash } from '../avoid/hash';
import type { DiagramLabel, LabelSpot } from '../labelTrait';
import type { Bounds } from '../outline';
import { labelCenter } from './station';

/** A connector's route as placement reads it: every point it runs through,
 *  its ends included. */
export interface PlaceRoute {
  id: string;
  points: readonly Vec2[];
  /** Further runs it draws, apart from `points`: the far stub of a connector
   *  split across pages. Other labels keep off them; its own stands on `points`. */
  more?: readonly (readonly Vec2[])[];
}

/** A label to place, or to steer the others off. */
export interface PlaceLabel {
  id: string;
  /** The connector it sits on: a {@link PlaceRoute}'s id. */
  edge: string;
  /** Its trait. `at` and `offset` are the preferred station; `placed`, where
   *  it stands now; `dodge: false`, never move it. */
  placement: DiagramLabel;
  size: { width: number; height: number };
  /** Whether it may move now. Default true. One that may not is an
   *  obstacle where it stands. */
  moving?: boolean;
}

/** What one placement reads. */
export interface PlaceLabelsInput {
  shapes: readonly { id: string; box: Bounds }[];
  routes: readonly PlaceRoute[];
  labels: readonly PlaceLabel[];
}

/** How labels are placed. Every field has a default. */
export interface PlaceLabelsOptions {
  /** How far a label keeps from what it dodges, in world units. Default 2. */
  gap?: number;
  /** Stations tried each way along the route. Default 4. */
  tries?: number;
  /** Room between one station and the next, beyond the label's width. Default 8. */
  spacing?: number;
}

/** Where a moving label settles: a station off its preference, or null when
 *  its preferred station is the best there is. */
export type LabelPlacements = Map<string, LabelSpot | null>;

interface Route {
  path: Path;
  points: readonly Vec2[];
  length: number;
}

interface Segment {
  edge: string;
  a: Vec2;
  b: Vec2;
}

interface Candidate {
  placement: DiagramLabel;
  spot: LabelSpot | null;
}

/** What placement measures a candidate against. */
interface Field {
  shapes: SpatialHash<Bounds>;
  labels: SpatialHash<Bounds>;
  segments: SpatialHash<Segment>;
  gap: number;
}

const NAMED = { start: 0, mid: 0.5, end: 1 } as const;

const grow = (b: Bounds, by: number): Bounds => ({ x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by });

function overlapArea(a: Bounds, b: Bounds): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Whether the segment from `a` to `b` passes through the inside of `box`. */
function crossesBox(a: Vec2, b: Vec2, box: Bounds): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q > 0;
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    return t0 < t1;
  };
  return clip(-dx, a.x - box.x) && clip(dx, box.x + box.width - a.x)
    && clip(-dy, a.y - box.y) && clip(dy, box.y + box.height - a.y);
}

/** How far along `points` the point nearest `p` lies. */
function arcNearest(points: readonly Vec2[], p: Vec2): number {
  let best = Infinity;
  let at = 0;
  let walked = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const { t, dist: d } = nearestOnLine(p.x, p.y, a.x, a.y, b.x, b.y);
    if (d < best) {
      best = d;
      at = walked + t * len;
    }
    walked += len;
  }
  return at;
}

/** The label's preferred station, then stations a label-width-and-`spacing`
 *  apart along the route each way, each on both sides of the line. */
function candidatesOf(label: PlaceLabel, route: Route, tries: number, spacing: number): Candidate[] {
  const { at, offset = 0, inset } = label.placement;
  const out: Candidate[] = [{ placement: { at, offset, ...(inset !== undefined ? { inset } : {}) }, spot: null }];
  const length = route.length;
  if (length === 0) return out;
  const start = typeof at === 'object' ? arcNearest(route.points, at.near) : (typeof at === 'number' ? at : NAMED[at] ?? 0.5) * length;
  const sides = offset === 0 ? [0] : [offset, -offset];
  const push = (s: number, side: number) => {
    const spot = { at: s / length, offset: side };
    out.push({ placement: { at: spot.at, offset: side }, spot });
  };
  if (offset !== 0) push(start, -offset);
  const step = label.size.width + spacing;
  for (let k = 1; k <= tries; k++) {
    for (const dir of [1, -1]) {
      const s = start + dir * k * step;
      if (s < 0 || s > length) continue;
      for (const side of sides) push(s, side);
    }
  }
  return out;
}

const boxAround = (c: Vec2, size: { width: number; height: number }): Bounds =>
  ({ x: c.x - size.width / 2, y: c.y - size.height / 2, width: size.width, height: size.height });

/** What a label standing on `box` costs: area over shapes, then over other
 *  labels, then the other routes it covers. */
function costOf(box: Bounds, edge: string, field: Field): number {
  const probe = grow(box, field.gap);
  let cost = 0;
  for (const s of field.shapes.query(probe)) cost += 1000 * overlapArea(probe, s);
  for (const l of field.labels.query(probe)) cost += 100 * overlapArea(probe, l);
  const covered = new Set<string>();
  for (const s of field.segments.query(probe)) if (s.edge !== edge && crossesBox(s.a, s.b, probe)) covered.add(s.edge);
  return cost + 10 * covered.size;
}

/** The cheapest of `label`'s candidates, and the box it takes. */
function settle(label: PlaceLabel, route: Route, field: Field, tries: number, spacing: number): { spot: LabelSpot | null; box: Bounds } | null {
  let best: { spot: LabelSpot | null; box: Bounds; score: number } | null = null;
  let home: Vec2 | null = null;
  for (const c of candidatesOf(label, route, tries, spacing)) {
    const center = labelCenter(route.path, c.placement, label.size);
    if (center === null) continue;
    home ??= center;
    const box = boxAround(center, label.size);
    const score = costOf(box, label.edge, field) + Math.hypot(center.x - home.x, center.y - home.y);
    if (best === null || score < best.score) best = { spot: c.spot, box, score };
    if (score === 0) break;
  }
  return best;
}

/** File each segment of `run`, connector `edge`'s, for `costOf` to count. */
function fileSegments(field: Field, edge: string, run: readonly Vec2[]): void {
  for (let i = 0; i + 1 < run.length; i++) {
    const a = run[i]!;
    const b = run[i + 1]!;
    field.segments.insert({ edge, a, b }, { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) });
  }
}

/**
 * Where each moving label settles. Each tries its preferred station, then
 * the stations either side of it along its route and across the line, and
 * keeps the cheapest: area over shapes ×1000, area over labels already
 * placed ×100, other routes it covers ×10, plus how far it moved. Labels
 * that are not moving are placed already; moving ones go in id order, each
 * an obstacle for the next, so the answer depends on nothing else.
 */
export function placeLabels(input: PlaceLabelsInput, opts: PlaceLabelsOptions = {}): LabelPlacements {
  const tries = opts.tries ?? 4;
  const spacing = opts.spacing ?? 8;
  const field: Field = { shapes: new SpatialHash(), labels: new SpatialHash(), segments: new SpatialHash(), gap: opts.gap ?? 2 };
  for (const { box } of input.shapes) field.shapes.insert(box, box);
  const routes = new Map<string, Route>();
  for (const { id, points, more = [] } of input.routes) {
    for (const run of [points, ...more]) fileSegments(field, id, run);
    if (points.length < 2) continue;
    let length = 0;
    for (let i = 0; i + 1 < points.length; i++) length += Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y);
    routes.set(id, { path: polylineFromPoints(points as Vec2[]), points, length });
  }
  const moving: PlaceLabel[] = [];
  for (const label of input.labels) {
    const route = routes.get(label.edge);
    if (route === undefined) continue;
    if (label.moving !== false && label.placement.dodge !== false) {
      moving.push(label);
      continue;
    }
    const center = labelCenter(route.path, label.placement, label.size);
    if (center === null) continue;
    const box = boxAround(center, label.size);
    field.labels.insert(box, box);
  }
  moving.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: LabelPlacements = new Map();
  for (const label of moving) {
    const best = settle(label, routes.get(label.edge)!, field, tries, spacing);
    if (best === null) continue;
    out.set(label.id, best.spot);
    field.labels.insert(best.box, best.box);
  }
  return out;
}
