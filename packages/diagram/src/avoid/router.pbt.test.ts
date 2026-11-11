/**
 * The obstacle-avoiding router on random scenes of shapes on a jittered grid, connectors glued to a shape or to some
 * of its ports, and waypoints in the gutters between shapes. Every route it answers leaves and arrives along its
 * ports and passes its waypoints (so the `avoid` router draws it rather than falling back), runs along the axes,
 * never enters a shape, and keeps its clearance from every shape but beside its own ports. An unchanged scene
 * reroutes nothing, whether routed or seeded, and a scene moved whole routes the same, moved.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Vec2 } from '@weasel-js/core/math';
import { nonFinite, runs, samePointsWithin, tally, timeoutFor } from '../pbt.fixture';
import { edgeBetween, entersBox, isOrthogonal, rectShape } from './avoidFixture';
import { routeHolds } from './holds';
import { createAvoidRouter, type AvoidRoutes } from './router';
import { AVOID_DEFAULTS, blocks, inflate, type AvoidEdge, type AvoidInput, type AvoidObstacle, type AvoidPort } from './types';

const RUNS = 60;
const PITCH = 180;
const COLS = 3;

interface ShapeSpec { cell: number; width: number; height: number; jx: number; jy: number }
interface EdgeSpec { a: number; b: number; from: string; to: string; waypoints: Vec2[]; label: boolean }
interface SceneSpec { shapes: ShapeSpec[]; edges: EdgeSpec[]; region: number[] | null }

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

const sceneSpec: fc.Arbitrary<SceneSpec> = shapeSpecs.chain((shapes) => fc.record({
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
function build(spec: SceneSpec, region = true): AvoidInput {
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

const scene = sceneSpec.map(build);

/** `input` with each edge holding the route `routes` gave it. */
function stored(input: AvoidInput, routes: AvoidRoutes): AvoidInput {
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
function checkRoutes(input: AvoidInput, routes: AvoidRoutes, seen: ReturnType<typeof tally>, all = true): void {
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
      let [ca, cb] = [i === 1 ? past(a, b, stub) : a, i === full.length - 1 ? past(b, a, stub) : b];
      if (i === 1 && i === full.length - 1 && Math.hypot(b.x - a.x, b.y - a.y) <= 2 * stub) cb = ca;
      for (const o of input.obstacles) {
        if (o.kind === 'label' || !blocks(o, edge)) continue;
        expect(entersBox(a, b, o.box), `${edge.id} enters ${o.id}: ${JSON.stringify(full)}`).toBe(false);
        expect(near(ca, cb, o.box, AVOID_DEFAULTS.clearance), `${edge.id} grazes ${o.id}: ${JSON.stringify(full)}`).toBe(false);
      }
    }
  }
}

describe('createAvoidRouter', () => {
  it('routes every connector along the axes, fitting its ports and waypoints, clear of every shape', () => {
    const seen = tally();
    fc.assert(fc.property(scene, (input) => {
      checkRoutes(input, createAvoidRouter().update(input), seen);
      if (input.obstacles.some((o) => o.kind === 'region')) seen.count('region');
    }), runs(RUNS));
    seen.atLeast('routed', RUNS);
    seen.atLeast('bent', RUNS / 2);
    seen.atLeast('region', RUNS / 4);
  }, timeoutFor(RUNS, 100));

  it('previews a dragged shape with routes that fit, then commits the frame', () => {
    const seen = tally();
    fc.assert(fc.property(sceneSpec.chain((spec) => fc.tuple(fc.constant(spec), fc.nat(spec.shapes.length - 1),
      fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }))), ([spec, k, jx, jy]) => {
      const input = build(spec);
      const router = createAvoidRouter();
      const routed = stored(input, router.update(input));
      // A preview routes against the obstacles committed, so the frame adds none.
      const hadRegion = input.obstacles.some((o) => o.kind === 'region');
      const frame = build({ ...spec, shapes: spec.shapes.map((s, i) => (i === k ? { ...s, jx, jy } : s)) }, hadRegion);
      const edges = frame.edges.map((e, i) => ({ ...e, ...(routed.edges[i]!.route ? { route: routed.edges[i]!.route } : {}) }));
      const preview = router.update({ ...frame, edges }, { preview: true });
      if (preview.size > 0) seen.count('previewed');
      checkRoutes(frame, preview, seen, false);
      checkRoutes(frame, router.update({ ...frame, edges }), seen, false);
    }), runs(RUNS));
    seen.atLeast('previewed', RUNS / 2);
  }, timeoutFor(RUNS, 200));

  it('reroutes nothing in a scene that has not changed, routed or seeded', () => {
    fc.assert(fc.property(scene, (input) => {
      const router = createAvoidRouter();
      const routed = stored(input, router.update(input));
      expect([...router.update(routed).keys()]).toEqual([]);
      // A seeded router has never searched for a connector holding no route, so it does, and spreads any it finds.
      const seeded = createAvoidRouter();
      seeded.seed(routed);
      const again = seeded.update(routed);
      if (routed.edges.every((e) => e.route !== undefined)) expect([...again.keys()]).toEqual([]);
      expect([...seeded.update(stored(routed, again)).keys()]).toEqual([]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 200));

  it('routes a scene moved whole the same, moved', () => {
    const dist = fc.integer({ min: -40, max: 40 }).map((n) => n * 10);
    // A label stands on its connector's first route, a slanted line until routed, at an irrational point a
    // translation moves by an ulp or so; equal-cost routes tie, and that ulp breaks the tie.
    const unlabeled = sceneSpec.map((spec) => build({ ...spec, edges: spec.edges.map((e) => ({ ...e, label: false })) }));
    fc.assert(fc.property(unlabeled, dist, dist, (input, dx, dy) => {
      const at = (p: Vec2) => ({ x: p.x + dx, y: p.y + dy });
      const moved: AvoidInput = {
        obstacles: input.obstacles.map((o) => ({ ...o, box: { ...o.box, ...at(o.box) } })),
        edges: input.edges.map((e) => ({
          ...e,
          from: { ...e.from, ports: e.from.ports.map((p) => ({ ...p, point: at(p.point) })) },
          to: { ...e.to, ports: e.to.ports.map((p) => ({ ...p, point: at(p.point) })) },
          ...(e.waypoints ? { waypoints: e.waypoints.map(at) } : {}),
        })),
      };
      const routes = createAvoidRouter().update(input);
      const shifted = createAvoidRouter().update(moved);
      // A bundle spread in thirds lands an ulp apart.
      for (const [id, r] of routes) {
        const s = shifted.get(id);
        if (r === null || s == null) expect(s).toBe(r);
        else expect(samePointsWithin(s, r.map(at), 1e-12)).toBe(true);
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 200));
});
