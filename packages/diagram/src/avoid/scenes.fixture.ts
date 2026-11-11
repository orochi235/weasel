/**
 * Random scenes for the avoid router's property tests: shapes on a jittered grid, a region around some of them,
 * connectors glued to a shape or to some of its ports, waypoints in the gutters, and labels; and the check every
 * route the router answers must pass. Test-only: nothing in the package imports it.
 */
import { expect } from 'vitest';
import fc from 'fast-check';
import type { Vec2 } from '@weasel-js/core/math';
import { nonFinite, type tally } from '../pbt.fixture';
import { edgeBetween, entersBox, isOrthogonal, rectShape } from './avoidFixture';
import { routeHolds } from './holds';
import type { AvoidRoutes } from './router';
import { AVOID_DEFAULTS, blocks, inflate, type AvoidEdge, type AvoidInput, type AvoidObstacle, type AvoidPort } from './types';

export const PITCH = 180;
export const COLS = 3;

export interface ShapeSpec { cell: number; width: number; height: number; jx: number; jy: number }
export interface EdgeSpec { a: number; b: number; from: string; to: string; waypoints: Vec2[]; label: boolean }
export interface SceneSpec { shapes: ShapeSpec[]; edges: EdgeSpec[]; region: number[] | null }

const shapeAt = ({ cell, width, height, jx, jy }: ShapeSpec): AvoidObstacle => rectShape(`s${cell}`,
  (cell % COLS) * PITCH + Math.min(jx, PITCH - width - 40),
  Math.floor(cell / COLS) * PITCH + Math.min(jy, PITCH - height - 40),
  width, height);

/** Shapes in the cells of a `COLS`-wide grid, each at least 40 short of its cell's far sides, so gutters stay open. */
const shapeSpecs: fc.Arbitrary<ShapeSpec[]> = fc.uniqueArray(fc.integer({ min: 0, max: COLS * COLS - 1 }), { minLength: 2, maxLength: 7 })
  .chain((cells) => fc.tuple(...cells.map((cell) => fc.record({
    cell: fc.constant(cell),
    width: fc.integer({ min: 4, max: 10 }).map((n) => n * 10),
    height: fc.integer({ min: 3, max: 7 }).map((n) => n * 10),
    jx: fc.integer({ min: 0, max: 100 }),
    jy: fc.integer({ min: 0, max: 100 }),
  }))));

/** A gutter crossing: 20 clear of every cell's shape. */
const gutter = fc.record({ i: fc.integer({ min: 0, max: COLS }), j: fc.integer({ min: 0, max: COLS }) })
  .map(({ i, j }) => ({ x: i * PITCH - 20, y: j * PITCH - 20 }));

const sides = fc.subarray(['n', 'e', 's', 'w'], { minLength: 1 }).map((s) => s.join(''));

export const sceneSpec: fc.Arbitrary<SceneSpec> = shapeSpecs.chain((shapes) => fc.record({
  shapes: fc.constant(shapes),
  edges: fc.array(fc.record({
    a: fc.nat(shapes.length - 1),
    b: fc.nat(shapes.length - 2),
    from: sides,
    to: sides,
    waypoints: fc.oneof({ weight: 3, arbitrary: fc.constant([]) }, { weight: 1, arbitrary: fc.array(gutter, { minLength: 1, maxLength: 2 }) }),
    label: fc.boolean(),
  }), { minLength: 1, maxLength: 5 }),
  region: fc.option(fc.subarray(shapes.map((_, k) => k), { minLength: 1 }), { freq: 3, nil: null }),
}));

/** The scene `spec` describes: its shapes, a region around some of them, and connectors between them. */
export function build(spec: SceneSpec, region = true): AvoidInput {
  const shapes = spec.shapes.map(shapeAt);
  const obstacles = [...shapes];
  if (region && spec.region !== null) {
    const inside = spec.region.map((k) => shapes[k]!);
    const [x0, y0] = [Math.min(...inside.map((o) => o.box.x)) - 15, Math.min(...inside.map((o) => o.box.y)) - 15];
    const [x1, y1] = [Math.max(...inside.map((o) => o.box.x + o.box.width)) + 15, Math.max(...inside.map((o) => o.box.y + o.box.height)) + 15];
    const box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    // A shape outside the region but under it, or within its clearance, has ports no route can leave cleanly.
    const clear = shapes.every((o) => inside.includes(o) || !touches(inflate(o.box, AVOID_DEFAULTS.clearance + 1), box));
    if (clear) obstacles.push({ id: 'region', kind: 'region', box, members: new Set(inside.map((o) => o.id)) });
  }
  return {
    obstacles,
    edges: spec.edges.map(({ a, b, from, to, waypoints, label }, k) => ({
      ...edgeBetween(`e${k}`, shapes[a]!, shapes[b >= a ? b + 1 : b]!, from, to, waypoints.length > 0 ? waypoints : undefined),
      ...(label ? { label: { id: `e${k}/label`, placement: { at: 'mid' as const, offset: 9 }, size: { width: 40, height: 14 } } } : {}),
    })),
  };
}

export const scene = sceneSpec.map(build);

/** `input` with each edge holding the route `routes` gave it. */
export function stored(input: AvoidInput, routes: AvoidRoutes): AvoidInput {
  return {
    obstacles: input.obstacles,
    edges: input.edges.map((e) => {
      const r = routes.get(e.id);
      if (r === undefined) return e;
      const { route: _r, ...rest } = e;
      return r === null ? rest : { ...rest, route: r };
    }),
  };
}

/** The ports `route` runs between: the first pair it fits, with the route's ends. */
function endsOf(edge: AvoidEdge, route: readonly Vec2[]): { from: AvoidPort; to: AvoidPort } | null {
  for (const from of edge.from.ports) {
    for (const to of edge.to.ports) if (routeHolds(from, to, edge.waypoints ?? [], route)) return { from, to };
  }
  return null;
}

const EPS = 1e-6;

const touches = (a: AvoidObstacle['box'], b: AvoidObstacle['box']) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/** `a` moved toward `b` by `by`, or `b` when it is nearer. */
function past(a: Vec2, b: Vec2, by: number): Vec2 {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return len <= by ? b : { x: a.x + ((b.x - a.x) * by) / len, y: a.y + ((b.y - a.y) * by) / len };
}

/** Whether the segment `a`–`b` comes within `by` of `box`'s interior. */
const near = (a: Vec2, b: Vec2, box: AvoidObstacle['box'], by: number) => entersBox(a, b, inflate(box, by - EPS));

/** Check every route `routes` answers, or with `all`, that it answers one for each of `input`'s connectors. */
export function checkRoutes(input: AvoidInput, routes: AvoidRoutes, seen: ReturnType<typeof tally>, all = true): void {
  for (const edge of input.edges) {
    const route = routes.get(edge.id);
    if (all) expect(route).not.toBeUndefined();
    if (route === undefined) continue;
    if (route === null) {
      seen.count('unrouted');
      continue;
    }
    seen.count('routed');
    if (route.length > 0) seen.count('bent');
    expect(nonFinite(route)).toEqual([]);
    const ends = endsOf(edge, route);
    expect(ends, `${edge.id} fits no pair of its ports: ${JSON.stringify(route)}`).not.toBeNull();
    const full = [ends!.from.point, ...route, ends!.to.point];
    expect(isOrthogonal(full)).toBe(true);
    for (let i = 1; i < full.length; i++) {
      const [a, b] = [full[i - 1]!, full[i]!];
      // A port's stub, `clearance + 1` long, is not searched: it runs through whatever clearance the port sits in.
      const stub = AVOID_DEFAULTS.clearance + 1;
      const ca = i === 1 ? past(a, b, stub) : a;
      const short = i === 1 && i === full.length - 1 && Math.hypot(b.x - a.x, b.y - a.y) <= 2 * stub;
      const cb = short ? ca : i === full.length - 1 ? past(b, a, stub) : b;
      for (const o of input.obstacles) {
        if (o.kind === 'label' || !blocks(o, edge)) continue;
        expect(entersBox(a, b, o.box), `${edge.id} enters ${o.id}: ${JSON.stringify(full)}`).toBe(false);
        expect(near(ca, cb, o.box, AVOID_DEFAULTS.clearance), `${edge.id} grazes ${o.id}: ${JSON.stringify(full)}`).toBe(false);
      }
    }
  }
}
