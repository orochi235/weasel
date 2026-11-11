/**
 * fast-check arbitraries shared by renderer's property tests: transforms, paths, and strokes for the parts of the
 * renderer that need no GPU. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { mat3, PathBuilder, type GlMat3, type Path, type PolygonPath } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

export interface Pt { x: number; y: number }

/** A multiple of 1/8 in `±limit`: exact in float32 and through a translation. */
export function eighth(limit = 200): fc.Arbitrary<number> {
  return fc.integer({ min: -limit * 8, max: limit * 8 }).map((n) => n / 8);
}

/** A number in `[min, max]` on a 1/64 grid, spread evenly across the range: `fc.double` crowds its ends and zero. */
export function spread(min: number, max: number): fc.Arbitrary<number> {
  return fc.noBias(fc.integer({ min: Math.ceil(min * 64), max: Math.floor(max * 64) })).map((n) => n / 64);
}

export function point(limit = 200): fc.Arbitrary<Pt> {
  return fc.record({ x: eighth(limit), y: eighth(limit) });
}

/** A scale of either sign over three decades, never zero. */
const factor = fc.tuple(spread(-1, 2), fc.boolean())
  .map(([e, neg]) => (neg ? -1 : 1) * 10 ** e);

/** An invertible affine transform: a turn, a skew, a scale on each axis, and a move. */
export const affine: fc.Arbitrary<GlMat3> = fc.record({
  turn: spread(-Math.PI, Math.PI),
  skew: fc.oneof(fc.constant(0), spread(-1, 1)),
  sx: factor, sy: factor,
  tx: spread(-1000, 1000), ty: spread(-1000, 1000),
}).map(({ turn, skew, sx, sy, tx, ty }) => {
  const c = Math.cos(turn), s = Math.sin(turn);
  // R · K · S, then the move.
  const a = sx * c, b = sx * s, cc = sy * (c * skew - s), d = sy * (s * skew + c);
  return mat3.fromAffine([a, b, cc, d, tx, ty]);
});

/** An affine transform that keeps the axes: a scale of either sign, maybe a quarter turn, and a move. */
export const axisAffine: fc.Arbitrary<GlMat3> = fc.record({
  sx: factor, sy: factor, quarter: fc.boolean(),
  tx: fc.double({ min: -1000, max: 1000, noNaN: true }), ty: fc.double({ min: -1000, max: 1000, noNaN: true }),
}).map(({ sx, sy, quarter, tx, ty }) => mat3.fromAffine(quarter ? [0, sy, sx, 0, tx, ty] : [sx, 0, 0, sy, tx, ty]));

/** `pts` as one subpath of straight segments. */
export function pathOf(pts: readonly Pt[], closed = false, origin?: Pt): PolygonPath {
  const b = new PathBuilder();
  if (origin) b.setOrigin(origin.x, origin.y);
  b.moveTo(pts[0]!.x, pts[0]!.y);
  for (const p of pts.slice(1)) b.lineTo(p.x, p.y);
  if (closed) b.close();
  return b.build();
}

/** A rect of either sign of extent. */
export const rectPath: fc.Arbitrary<Path> = fc.record({
  x: eighth(), y: eighth(), width: eighth(100), height: eighth(100),
}).map((r) => ({ kind: 'rect' as const, ...r }));

/** A polyline of 2..6 points no two neighbors of which coincide, open or closed, maybe measured from an origin, with
 *  a cubic or two among its segments. */
export const polygonPath: fc.Arbitrary<Path> = fc.record({
  pts: fc.array(point(), { minLength: 2, maxLength: 6 }),
  closed: fc.boolean(),
  origin: fc.option(point(1000), { nil: undefined }),
  curve: fc.option(fc.tuple(point(), point(), point()), { nil: undefined }),
}).filter(({ pts }) => pts.every((p, i) => i === 0 || p.x !== pts[i - 1]!.x || p.y !== pts[i - 1]!.y))
  .map(({ pts, closed, origin, curve }) => {
    const b = new PathBuilder();
    if (origin) b.setOrigin(origin.x, origin.y);
    b.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) b.lineTo(p.x, p.y);
    if (curve) b.curveTo(curve[0].x, curve[0].y, curve[1].x, curve[1].y, curve[2].x, curve[2].y);
    if (closed) b.close();
    return b.build();
  });

export const anyPath: fc.Arbitrary<Path> = fc.oneof(rectPath, polygonPath);

/** A stroke of any shape the tessellator draws, markers left out: a world or `{ px }` width, caps, joins, a miter
 *  limit, alignment, a dash, per-vertex widths, and a nib. */
export const stroke: fc.Arbitrary<Stroke> = fc.record({
  width: fc.oneof(
    fc.double({ min: 0.125, max: 40, noNaN: true }),
    fc.double({ min: 0.5, max: 20, noNaN: true }).map((px) => ({ px })),
  ),
  cap: fc.constantFrom('butt', 'round', 'square'),
  join: fc.constantFrom('miter', 'round', 'bevel'),
  miterLimit: fc.option(fc.double({ min: 1, max: 20, noNaN: true }), { nil: undefined }),
  align: fc.constantFrom('center', 'inner', 'outer'),
  dash: fc.option(fc.array(fc.double({ min: 0.5, max: 20, noNaN: true }), { minLength: 2, maxLength: 4 }), { nil: undefined }),
  vertexWidths: fc.option(fc.array(fc.double({ min: 0, max: 30, noNaN: true }), { minLength: 1, maxLength: 7 }), { nil: undefined }),
  nib: fc.option(fc.record({ angle: fc.double({ min: -4, max: 4, noNaN: true }), ratio: fc.double({ min: 0, max: 1, noNaN: true }) }), { nil: undefined }),
}, { requiredKeys: ['width'] }) as fc.Arbitrary<Stroke>;

/** Every point a mesh holds, `origin` added. */
export function meshPoints(mesh: { vertices: Float32Array; origin?: { x: number; y: number } }): Pt[] {
  const ox = mesh.origin?.x ?? 0, oy = mesh.origin?.y ?? 0;
  const out: Pt[] = [];
  for (let i = 0; i + 1 < mesh.vertices.length; i += 2) out.push({ x: mesh.vertices[i]! + ox, y: mesh.vertices[i + 1]! + oy });
  return out;
}

/** Every non-finite number anywhere under `value`, by its path. */
export function nonFinite(value: unknown, at = ''): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${at}=${value}`];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => nonFinite(v, `${at}.${k}`));
}
