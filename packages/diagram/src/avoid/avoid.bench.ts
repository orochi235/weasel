/**
 * The avoid router against its performance budget. Run on the fleet:
 * `onto do --kind bench -in weasel -- npm run bench:avoid`. Prints each case
 * as it finishes.
 */
import { edgeBetween, nearEdges, randomShapes, seeded } from './avoidFixture';
import { createAvoidRouter, type AvoidRoutes } from './router';
import type { AvoidInput, AvoidObstacle } from './types';

const PITCH = 180;

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

/** `input` with shape `id` moved by `(dx, dy)`, and the ports of every edge on it. */
function moved(input: AvoidInput, base: AvoidInput, id: string, dx: number, dy: number): AvoidInput {
  const shift = (o: AvoidObstacle): AvoidObstacle => (o.id === id ? { ...o, box: { ...o.box, x: o.box.x + dx, y: o.box.y + dy } } : o);
  const obstacles = base.obstacles.map(shift);
  const byId = new Map(obstacles.map((o) => [o.id, o]));
  const edges = input.edges.map((e) => {
    if (e.from.node !== id && e.to.node !== id) return e;
    const fresh = edgeBetween(e.id, byId.get(e.from.node)!, byId.get(e.to.node)!);
    return { ...fresh, ...(e.route ? { route: e.route } : {}) };
  });
  return { obstacles, edges };
}

const ms = (t0: number) => performance.now() - t0;
const fmt = (v: number) => v.toFixed(2).padStart(7);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

function layout(seed: number, shapes: number, edges: number): AvoidInput {
  const rand = seeded(seed);
  const obstacles = randomShapes(rand, shapes, PITCH);
  return { obstacles, edges: nearEdges(rand, obstacles, edges) };
}

/** The shape most connectors meet: the worst place to drag. */
function busiest(input: AvoidInput): string {
  const count = new Map<string, number>();
  for (const e of input.edges) for (const n of [e.from.node, e.to.node]) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0]![0];
}

const CASES = 3;

function dragFrames(): void {
  const base = layout(1, 200, 300);
  const router = createAvoidRouter();
  const input = stored(base, router.update(base));
  const id = busiest(input);
  const times: number[] = [];
  const dirty: number[] = [];
  for (let f = 1; f <= 40; f++) {
    const frame = moved(input, base, id, f * 3, f * 2);
    const t0 = performance.now();
    const routes = router.update(frame, { preview: true });
    times.push(ms(t0));
    dirty.push(routes.size);
  }
  process.stdout.write(`1/${CASES} drag frame   200 shapes  300 connectors  dirty ${String(Math.max(...dirty)).padStart(3)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget    4.00 ms\n`);
}

function commits(): void {
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
  process.stdout.write(`2/${CASES} commit       200 shapes  300 connectors  dirty ${String(Math.max(...dirty)).padStart(3)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget   30.00 ms\n`);
}

function fullRoute(): void {
  const times: number[] = [];
  let failed = 0;
  for (let run = 0; run < 3; run++) {
    const input = layout(3 + run, 500, 800);
    const t0 = performance.now();
    const routes = createAvoidRouter().update(input);
    times.push(ms(t0));
    failed = [...routes.values()].filter((r) => r === null).length;
  }
  process.stdout.write(`3/${CASES} full route   500 shapes  800 connectors  unrouted ${String(failed).padStart(3)}  median ${fmt(median(times))} ms  max ${fmt(Math.max(...times))} ms  budget  150.00 ms\n`);
}

dragFrames();
commits();
fullRoute();
