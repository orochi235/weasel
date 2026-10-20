/** Test fixtures for the avoid router: rect shapes with compass ports, and seeded random layouts. */
import type { Vec2 } from '@weasel-js/core/math';
import { ObstacleIndex } from './obstacles';
import { AVOID_DEFAULTS, inflate, type AvoidEdge, type AvoidObstacle, type AvoidPort, type Box } from './types';

export const rectShape = (id: string, x: number, y: number, width = 100, height = 60): AvoidObstacle =>
  ({ id, kind: 'shape', box: { x, y, width, height } });

const PORTS: Record<'n' | 'e' | 's' | 'w', (b: Box) => AvoidPort> = {
  n: (b) => ({ point: { x: b.x + b.width / 2, y: b.y }, normal: { x: 0, y: -1 } }),
  e: (b) => ({ point: { x: b.x + b.width, y: b.y + b.height / 2 }, normal: { x: 1, y: 0 } }),
  s: (b) => ({ point: { x: b.x + b.width / 2, y: b.y + b.height }, normal: { x: 0, y: 1 } }),
  w: (b) => ({ point: { x: b.x, y: b.y + b.height / 2 }, normal: { x: -1, y: 0 } }),
};

/** The ports of `shape` named by `sides`: one for a named port, all four for an end glued to the shape. */
export const portsOf = (shape: AvoidObstacle, sides: string = 'nesw'): AvoidPort[] =>
  [...sides].map((s) => PORTS[s as 'n'](shape.box));

/** A connector from `a` to `b`, by the sides each end may use. */
export const edgeBetween = (id: string, a: AvoidObstacle, b: AvoidObstacle, fromSides = 'nesw', toSides = 'nesw', waypoints?: Vec2[]): AvoidEdge => ({
  id,
  from: { node: a.id, ports: portsOf(a, fromSides) },
  to: { node: b.id, ports: portsOf(b, toSides) },
  ...(waypoints ? { waypoints } : {}),
});

/** A seeded generator of numbers in [0, 1). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` shapes on a jittered grid `pitch` apart, none closer than three clearances. */
export function randomShapes(rand: () => number, count: number, pitch = 180): AvoidObstacle[] {
  const cols = Math.ceil(Math.sqrt(count));
  const out: AvoidObstacle[] = [];
  for (let k = 0; k < count; k++) {
    const width = 40 + Math.round(rand() * 60);
    const height = 30 + Math.round(rand() * 40);
    const x = (k % cols) * pitch + Math.round(rand() * (pitch - width - 40));
    const y = Math.floor(k / cols) * pitch + Math.round(rand() * (pitch - height - 40));
    out.push(rectShape(`s${k}`, x, y, width, height));
  }
  return out;
}

/** `count` connectors between random pairs of `shapes`, glued to the shapes. */
export function randomEdges(rand: () => number, shapes: readonly AvoidObstacle[], count: number): AvoidEdge[] {
  const out: AvoidEdge[] = [];
  for (let k = 0; k < count; k++) {
    const a = shapes[Math.floor(rand() * shapes.length)]!;
    let b = shapes[Math.floor(rand() * shapes.length)]!;
    if (b === a) b = shapes[(shapes.indexOf(a) + 1) % shapes.length]!;
    out.push(edgeBetween(`e${k}`, a, b));
  }
  return out;
}

/** The context `routeEdge` reads for `obstacles`, with the defaults. */
export function routeContext(obstacles: readonly AvoidObstacle[]) {
  const index = new ObstacleIndex(obstacles, AVOID_DEFAULTS.clearance);
  const limit = inflate({ x: -1000, y: -1000, width: 6000, height: 6000 }, 0);
  return { index, options: AVOID_DEFAULTS, limit };
}

const EPS = 1e-6;

/** Whether segment `a`–`b` passes through the inside of `box`. */
export function entersBox(a: Vec2, b: Vec2, box: Box): boolean {
  const lx = Math.min(a.x, b.x);
  const hx = Math.max(a.x, b.x);
  const ly = Math.min(a.y, b.y);
  const hy = Math.max(a.y, b.y);
  return hx > box.x + EPS && lx < box.x + box.width - EPS && hy > box.y + EPS && ly < box.y + box.height - EPS;
}

/** Whether every segment of `points` runs along an axis. */
export const isOrthogonal = (points: readonly Vec2[]): boolean =>
  points.every((p, i) => i === 0 || Math.abs(p.x - points[i - 1]!.x) < EPS || Math.abs(p.y - points[i - 1]!.y) < EPS);

/** How many times `points` turns. */
export const bendsOf = (points: readonly Vec2[]): number => Math.max(0, points.length - 2);
