/**
 * Label placement, and the avoid router with labels, against their
 * performance budget. Run on the fleet:
 * `onto do --kind bench -in weasel -- npm run bench:labels`. Prints each case
 * as it finishes.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { nearEdges, randomShapes, seeded } from '../avoid/avoidFixture';
import { fullRoute } from '../avoid/dirty';
import { createAvoidRouter, type AvoidRoutes } from '../avoid/router';
import type { AvoidEdge, AvoidInput, AvoidObstacle } from '../avoid/types';
import { placeLabels, type PlaceLabel, type PlaceLabelsInput } from './place';

const CASES = 3;
const ms = (t0: number) => performance.now() - t0;
const fmt = (v: number) => v.toFixed(2).padStart(7);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

const labeled = (e: AvoidEdge): AvoidEdge =>
  ({ ...e, label: { id: `${e.id}/label`, placement: { at: 'mid', offset: 9 }, size: { width: 40, height: 12 } } });

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

function layout(seed: number, shapes: number, edges: number): AvoidInput {
  const rand = seeded(seed);
  const obstacles = randomShapes(rand, shapes);
  return { obstacles, edges: nearEdges(rand, obstacles, edges).map(labeled) };
}

/** 200 shapes and 300 routed, labeled connectors, as placement reads them. */
function placementInput(): PlaceLabelsInput {
  const base = layout(1, 200, 300);
  const input = stored(base, createAvoidRouter().update(base));
  const routes = input.edges.map((e) => ({ id: e.id, points: fullRoute(e) as Vec2[] }));
  const labels: PlaceLabel[] = input.edges.map((e) => ({ id: e.label!.id, edge: e.id, placement: e.label!.placement, size: e.label!.size }));
  return { shapes: input.obstacles.map((o) => ({ id: o.id, box: o.box })), routes, labels };
}

function commit(input: PlaceLabelsInput): void {
  const rand = seeded(7);
  const times: number[] = [];
  let moved = 0;
  for (let run = 0; run < 20; run++) {
    const moving = new Set<string>();
    while (moving.size < 40) moving.add(input.labels[Math.floor(rand() * input.labels.length)]!.id);
    const labels = input.labels.map((l) => ({ ...l, moving: moving.has(l.id) }));
    const t0 = performance.now();
    const out = placeLabels({ ...input, labels });
    times.push(ms(t0));
    moved = Math.max(moved, [...out.values()].filter((s) => s !== null).length);
  }
  process.stdout.write(`1/${CASES} commit          200 shapes  300 labels  moving  40  moved ${String(moved).padStart(3)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget    8.00 ms\n`);
}

function full(input: PlaceLabelsInput): void {
  const times: number[] = [];
  let moved = 0;
  for (let run = 0; run < 10; run++) {
    const t0 = performance.now();
    const out = placeLabels(input);
    times.push(ms(t0));
    moved = [...out.values()].filter((s) => s !== null).length;
  }
  process.stdout.write(`2/${CASES} full placement  200 shapes  300 labels  moving 300  moved ${String(moved).padStart(3)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget   40.00 ms\n`);
}

/** The shape most connectors meet. */
function busiest(input: AvoidInput): string {
  const count = new Map<string, number>();
  for (const e of input.edges) for (const n of [e.from.node, e.to.node]) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0]![0];
}

/** `input` with shape `id` moved by `(dx, dy)`, and the ports of every edge on it. */
function moved(input: AvoidInput, base: AvoidInput, id: string, dx: number, dy: number): AvoidInput {
  const shift = (o: AvoidObstacle): AvoidObstacle => (o.id === id ? { ...o, box: { ...o.box, x: o.box.x + dx, y: o.box.y + dy } } : o);
  const obstacles = base.obstacles.map(shift);
  const byId = new Map(obstacles.map((o) => [o.id, o]));
  const edges = input.edges.map((e) => {
    if (e.from.node !== id && e.to.node !== id) return e;
    const ports = (o: AvoidObstacle) => [
      { point: { x: o.box.x + o.box.width / 2, y: o.box.y }, normal: { x: 0, y: -1 } },
      { point: { x: o.box.x + o.box.width, y: o.box.y + o.box.height / 2 }, normal: { x: 1, y: 0 } },
      { point: { x: o.box.x + o.box.width / 2, y: o.box.y + o.box.height }, normal: { x: 0, y: 1 } },
      { point: { x: o.box.x, y: o.box.y + o.box.height / 2 }, normal: { x: -1, y: 0 } },
    ];
    return { ...e, from: { ...e.from, ports: ports(byId.get(e.from.node)!) }, to: { ...e.to, ports: ports(byId.get(e.to.node)!) } };
  });
  return { obstacles, edges };
}

function avoidCommit(): void {
  const base = layout(2, 200, 300);
  const router = createAvoidRouter();
  let input = stored(base, router.update(base));
  const id = busiest(input);
  const times: number[] = [];
  const dirty: number[] = [];
  for (let c = 1; c <= 10; c++) {
    const next = moved(input, base, id, c * 25, (c % 3) * 20);
    const t0 = performance.now();
    const routes = router.update(next);
    times.push(ms(t0));
    dirty.push(routes.size);
    input = stored(next, routes);
  }
  process.stdout.write(`3/${CASES} avoid commit    200 shapes  300 labeled connectors  dirty ${String(Math.max(...dirty)).padStart(3)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget   30.00 ms\n`);
}

const input = placementInput();
commit(input);
full(input);
avoidCommit();
