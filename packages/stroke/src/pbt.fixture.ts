/**
 * fast-check arbitraries shared by stroke's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { PathBuilder, type PolygonPath } from '@weasel-js/geom';

export interface Pt { x: number; y: number }

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** A multiple of 1/8 in `±limit`: exact through a translation or a quarter turn, in a double and in float32. */
export function eighth(limit = 200): fc.Arbitrary<number> {
  return fc.integer({ min: -limit * 8, max: limit * 8 }).map((n) => n / 8);
}

export function point(limit = 200): fc.Arbitrary<Pt> {
  return fc.record({ x: eighth(limit), y: eighth(limit) });
}

/** Points no two neighbors of which are closer than `minGap`, the closing pair included when `closed`. */
export function polyline(
  { minLength = 2, maxLength = 6, limit = 200, minGap = 1, closed = false } = {},
): fc.Arbitrary<Pt[]> {
  return fc.array(point(limit), { minLength, maxLength }).filter((pts) => {
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i]!, b = pts[(i + 1) % n]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < minGap) return false;
    }
    return true;
  });
}

/** `pts` as one subpath of straight segments. */
export function pathOf(pts: readonly Pt[], closed = false): PolygonPath {
  const b = new PathBuilder().moveTo(pts[0]!.x, pts[0]!.y);
  for (const p of pts.slice(1)) b.lineTo(p.x, p.y);
  if (closed) b.close();
  return b.build();
}

/** A regular `n`-gon, clockwise on a y-down screen, with its inradius and perimeter. */
export interface Ngon { pts: Pt[]; n: number; inradius: number; perimeter: number; area: number }

export const ngon: fc.Arbitrary<Ngon> = fc.record({
  n: fc.integer({ min: 3, max: 8 }),
  r: fc.double({ min: 5, max: 100, noNaN: true }),
  turn: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
  cx: fc.double({ min: -100, max: 100, noNaN: true }),
  cy: fc.double({ min: -100, max: 100, noNaN: true }),
}).map(({ n, r, turn, cx, cy }) => {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = turn + (i * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const inradius = r * Math.cos(Math.PI / n);
  const side = 2 * r * Math.sin(Math.PI / n);
  return { pts, n, inradius, perimeter: n * side, area: (n * side * inradius) / 2 };
});

/** Distance from `p` to the segment `a`–`b`. */
export function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Distance from `p` to the polyline through `pts`. */
export function polylineDistance(p: Pt, pts: readonly Pt[], closed = false): number {
  let best = Infinity;
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) best = Math.min(best, segmentDistance(p, pts[i]!, pts[(i + 1) % n]!));
  return best;
}

/** Counts the cases a property actually checked, so one that filters every input away fails instead of passing. */
export function tally(): { hit(): void; atLeast(share: number, of: number): void; count(): number } {
  let n = 0;
  return {
    hit: () => { n++; },
    count: () => n,
    atLeast(share, of) {
      if (n < Math.ceil(share * of)) throw new Error(`only ${n} of ${of} runs checked anything`);
    },
  };
}
