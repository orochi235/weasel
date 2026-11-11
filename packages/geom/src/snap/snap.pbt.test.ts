import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { closestOnFlat, flatDim, intersectFlats, orthonormalize, solveLeastSquares, type Flat, type Vec } from './flat';
import { resolveSnap, type SnapCandidate, type SnapProblem } from './resolve';
import { createPathSnapIndex, findPathSnap, findPathSnaps, PATH_SNAP_KINDS } from './pathSnap';
import { nearestOnPath } from '../nearest';
import { transformPath } from '../paths/transformPath';
import { translate } from '../affine';
import type { Path } from '../path';
import { circle, coord, eighth, runs, star } from '../pbt.fixture';

const RUNS = runs(200);

const dist = (a: Vec, b: Vec): number => Math.hypot(...a.map((v, i) => v - b[i]!));
const dimension = fc.integer({ min: 1, max: 4 });
const vecOf = (n: number, limit = 100): fc.Arbitrary<Vec> => fc.array(coord(limit), { minLength: n, maxLength: n });
const flatOf = (n: number): fc.Arbitrary<Flat> => fc.record({
  at: vecOf(n), dirs: fc.array(fc.oneof(vecOf(n, 10), fc.constant(Array(n).fill(0))), { maxLength: n + 1 }),
});

describe('flats, a direction whose square underflows (shrunk counterexample)', () => {
  it('still spans its line, in orthonormalize and in solveLeastSquares', () => {
    // 1e-300 squared is 0, so the direction was taken for a zero one and dropped.
    expect(orthonormalize([[1.0000010100010202e-300]])).toEqual([[1]]);
    expect(flatDim({ at: [0, 0], dirs: [[1e-300, 1e-300]] })).toBe(1);
    expect(solveLeastSquares([[0, 1e-300]], [0, 3])[0]).toBeCloseTo(3e300, -290);
    expect(orthonormalize([[1e200, 0]])).toEqual([[1, 0]]);
  });
});

describe('flats, property', () => {
  it('orthonormalize gives orthonormal vectors spanning what it was given', () => {
    fc.assert(fc.property(dimension.chain((n) => fc.array(vecOf(n, 10), { maxLength: n + 1 })), (vecs) => {
      const q = orthonormalize(vecs);
      for (let i = 0; i < q.length; i++) {
        for (let j = 0; j < q.length; j++) {
          const d = q[i]!.reduce((s, v, k) => s + v * q[j]![k]!, 0);
          expect(Math.abs(d - (i === j ? 1 : 0))).toBeLessThan(1e-12);
        }
      }
      // What a dropped vector keeps outside the span is below the rank tolerance of its length.
      for (const v of vecs) {
        const n = Math.hypot(...v);
        const rest = closestOnFlat({ at: v.map(() => 0), dirs: q }, v);
        expect(dist(rest, v)).toBeLessThanOrEqual(1e-6 * n * 1.01 + 1e-300);
      }
    }), RUNS);
  });

  it('solveLeastSquares combines the columns to the projection onto their span, at any magnitude', () => {
    const magnitude = fc.double({ min: -310, max: 300, noNaN: true }).map((k) => 10 ** k);
    const cols = (n: number) => fc.array(fc.tuple(vecOf(n, 10), magnitude).map(([v, m]) => v.map((x) => x * m)), { maxLength: n });
    fc.assert(fc.property(dimension.chain((n) => fc.tuple(cols(n), vecOf(n))), ([cs, rhs]) => {
      const x = solveLeastSquares(cs, rhs);
      const got = rhs.map((_, i) => cs.reduce((s, c, j) => s + x[j]! * c[i]!, 0));
      const want = closestOnFlat({ at: rhs.map(() => 0), dirs: cs }, rhs);
      // Where the columns are nearly dependent the coefficients are ill-conditioned; compare the points they reach.
      expect(dist(got, want)).toBeLessThan(1e-6 * (Math.hypot(...rhs) + 1));
    }), RUNS);
  });

  it('closestOnFlat is a projection: on the flat, idempotent, and nearer than any other point of it', () => {
    fc.assert(fc.property(dimension.chain((n) => fc.tuple(flatOf(n), vecOf(n), fc.array(coord(10), { minLength: n + 1, maxLength: n + 1 }))), ([f, p, c]) => {
      const q = closestOnFlat(f, p);
      const scale = Math.hypot(...p) + Math.hypot(...f.at) + 1;
      expect(dist(closestOnFlat(f, q), q)).toBeLessThan(scale * 1e-12);
      const other = f.dirs.reduce<Vec>((acc, d, i) => acc.map((v, k) => v + c[i]! * d[k]!), f.at);
      expect(dist(q, p)).toBeLessThanOrEqual(dist(other, p) + scale * 1e-12);
    }), RUNS);
  });

  it('intersectFlats holds only points of both, and is as large as the two allow', () => {
    const tally = { met: 0 };
    fc.assert(fc.property(dimension.chain((n) => fc.tuple(flatOf(n), flatOf(n), fc.array(coord(10), { minLength: n, maxLength: n }))), ([a, b, c]) => {
      const x = intersectFlats(a, b);
      if (!x) return;
      tally.met++;
      const scale = Math.hypot(...a.at) + Math.hypot(...b.at) + 100;
      const p = orthonormalize(x.dirs).reduce<Vec>((acc, d, i) => acc.map((v, k) => v + (c[i] ?? 0) * d[k]!), x.at);
      expect(dist(closestOnFlat(a, p), p)).toBeLessThan(1e-6 * scale);
      expect(dist(closestOnFlat(b, p), p)).toBeLessThan(1e-6 * scale);
      const n = a.at.length;
      expect(flatDim(x)).toBeGreaterThanOrEqual(flatDim(a) + flatDim(b) - n);
      expect(flatDim(x)).toBeLessThanOrEqual(Math.min(flatDim(a), flatDim(b)));
    }), RUNS);
    expect(tally.met).toBeGreaterThan(RUNS.numRuns / 4);
  });
});

/** A 2D snap problem: a probe or two, and points, axis lines, and slanted lines near them. Coordinates are
 *  multiples of 1/8, so a translation by one moves every distance exactly. */
const locus = fc.oneof(
  fc.tuple(eighth(40), eighth(40)).map(([x, y]): Flat => ({ at: [x, y], dirs: [] })),
  eighth(40).map((x): Flat => ({ at: [x, 0], dirs: [[0, 1]] })),
  eighth(40).map((y): Flat => ({ at: [0, y], dirs: [[1, 0]] })),
);
const slanted = fc.tuple(eighth(40), eighth(40), fc.integer({ min: -3, max: 3 }), fc.integer({ min: -3, max: 3 }))
  .filter(([, , a, b]) => a !== 0 || b !== 0)
  .map(([x, y, a, b]): Flat => ({ at: [x, y], dirs: [[a, b]] }));
const candidateOf = (loci: fc.Arbitrary<Flat>) => fc.record({
  probe: fc.constantFrom('p', 'q'), locus: loci, tier: fc.constantFrom('target' as const, 'fallback' as const),
  reachPx: fc.constantFrom(4, 8, 16, Infinity), required: fc.oneof({ weight: 9, arbitrary: fc.constant(undefined) }, { weight: 1, arbitrary: fc.constant(true) }),
});
const problemOf = (loci: fc.Arbitrary<Flat>) => fc.record({
  p: fc.tuple(eighth(20), eighth(20)), q: fc.tuple(eighth(20), eighth(20)),
  delta0: fc.tuple(eighth(40), eighth(40)),
  axis: fc.constantFrom<'both' | 'x' | 'y'>('both', 'both', 'x', 'y'),
  zoom: fc.constantFrom(0.5, 1, 2, 4),
  candidates: fc.array(candidateOf(loci), { maxLength: 6 }),
}).map(({ p, q, delta0, axis, zoom, candidates }): SnapProblem<number> => ({
  probes: [{ id: 'p', at: p, role: 'origin' }, { id: 'q', at: q, role: 'box' }],
  input: { at: [0, 0], dirs: axis === 'both' ? [[1, 0], [0, 1]] : axis === 'x' ? [[1, 0]] : [[0, 1]] },
  delta0,
  toScreen: (w) => w.map((v) => v * zoom),
  candidates: candidates.map((c, i): SnapCandidate<number> => ({ ...c, source: 's', order: i, mark: i })),
}));

const shifted = (prob: SnapProblem<number>, t: Vec): SnapProblem<number> => {
  const plus = (v: Vec): Vec => v.map((x, i) => x + t[i]!);
  return {
    ...prob,
    probes: prob.probes.map((p) => ({ ...p, at: plus(p.at) })),
    candidates: prob.candidates.map((c) => ({ ...c, locus: { ...c.locus, at: plus(c.locus.at) } })),
    toScreen: (w) => prob.toScreen(w.map((x, i) => x - t[i]!)),
  };
};

describe('resolveSnap, property', () => {
  it('moves within the input, onto every candidate it reports, and nowhere when nothing snaps', () => {
    const tally = { snapped: 0, required: 0 };
    fc.assert(fc.property(problemOf(fc.oneof(locus, slanted)), (prob) => {
      const r = resolveSnap(prob);
      const scale = 100;
      expect(dist(closestOnFlat(prob.input, r.delta), r.delta)).toBeLessThan(1e-9 * scale);
      const at = new Map(prob.probes.map((p) => [p.id, p.at]));
      for (const c of [...r.members, ...r.satisfied]) {
        const world = at.get(c.probe)!.map((v, i) => v + r.delta[i]!);
        expect(dist(closestOnFlat(c.locus, world), world)).toBeLessThan(1e-6);
      }
      if (r.members.length === 0) expect(dist(r.delta, closestOnFlat(prob.input, prob.delta0))).toBeLessThan(1e-12 * scale);
      else tally.snapped++;
      if (prob.candidates.some((c) => c.required)) {
        // A required candidate the input can reach at all is always in the result.
        const reachable = prob.candidates.some((c) => c.required
          && intersectFlats(prob.input, { at: c.locus.at.map((v, i) => v - at.get(c.probe)![i]!), dirs: c.locus.dirs }) !== null);
        if (reachable) { tally.required++; expect(r.members.some((c) => c.required)).toBe(true); }
      }
      expect(r.codim).toBeLessThanOrEqual(flatDim(prob.input));
      expect(r.codim > 0).toBe(r.members.length > 0);
    }), RUNS);
    expect(tally.snapped).toBeGreaterThan(RUNS.numRuns / 4);
    expect(tally.required).toBeGreaterThan(RUNS.numRuns / 20);
  });

  it('answers the same move when the scene moves whole, the view with it', () => {
    fc.assert(fc.property(problemOf(locus), fc.tuple(eighth(500), eighth(500)), (prob, t) => {
      const a = resolveSnap(prob), b = resolveSnap(shifted(prob, t));
      expect(b.delta).toEqual(a.delta);
      expect(b.members.map((c) => c.order)).toEqual(a.members.map((c) => c.order));
    }), RUNS);
  });

  it('ignores the order candidates are listed in, and a candidate out of reach', () => {
    fc.assert(fc.property(problemOf(fc.oneof(locus, slanted)), fc.nat(), (prob, seed) => {
      const a = resolveSnap(prob);
      const shuffled = [...prob.candidates].sort((x, y) => ((x.order * 7919 + seed) % 13) - ((y.order * 7919 + seed) % 13));
      const far: SnapCandidate<number> = {
        probe: 'p', locus: { at: [1e5, 1e5], dirs: [] }, source: 's', order: -1, tier: 'target', reachPx: 8, mark: -1,
      };
      const b = resolveSnap({ ...prob, candidates: [far, ...shuffled] });
      expect(dist(b.delta, a.delta)).toBeLessThan(1e-9);
      expect(new Set(b.members.map((c) => c.order))).toEqual(new Set(a.members.map((c) => c.order)));
    }), RUNS);
  });
});

describe('path snapping, property', () => {
  const paths = fc.array(fc.oneof(star, circle), { minLength: 1, maxLength: 3 });
  const query = fc.record({
    radius: fc.double({ min: 1, max: 30, noNaN: true }), sx: fc.constantFrom(0.5, 1, 2), sy: fc.constantFrom(0.5, 1, 2),
    kinds: fc.constantFrom(undefined, ['nearest' as const], ['anchor' as const, 'nearest' as const]),
  });

  it('finds every hit within its radius, measured as it says, and the nearest of them first', () => {
    const tally = { hits: 0, nearest: 0 };
    fc.assert(fc.property(paths, fc.tuple(coord(80), coord(80)), query, (ps, [x, y], { radius, sx, sy, kinds }) => {
      const index = createPathSnapIndex(ps);
      const q = { radius, scale: { x: sx, y: sy }, kinds };
      const hits = findPathSnaps(index, { x, y }, q);
      for (const h of hits) {
        tally.hits++;
        expect(h.distance).toBeLessThanOrEqual(radius);
        expect(Math.abs(h.distance - Math.hypot((h.x - x) * sx, (h.y - y) * sy))).toBeLessThan(1e-9);
        for (const i of h.paths) expect(i >= 0 && i < ps.length).toBe(true);
        if (h.kind === 'nearest' || h.kind === 'anchor' || h.kind === 'midpoint' || h.kind === 'extremum' || h.kind === 'intersection') {
          // Each lies on a stroke of the path it names.
          for (const i of h.paths) {
            const p = ps[i]!;
            if (p.kind === 'rect') continue;
            expect(nearestOnPath(p.commands, p.coords, h.x, h.y)!.dist).toBeLessThan(1e-3);
          }
        }
        if (h.kind === 'nearest') tally.nearest++;
      }
      if (hits.some((h) => h.kind === 'nearest')) expect(hits.every((h) => h.kind === 'nearest')).toBe(true);
      const best = findPathSnap(index, { x, y }, q);
      if (hits.length === 0) expect(best).toBeNull();
      else expect(best!.distance).toBe(Math.min(...hits.map((h) => h.distance)));
    }), RUNS);
    expect(tally.hits).toBeGreaterThan(RUNS.numRuns);
    expect(tally.nearest).toBeGreaterThan(RUNS.numRuns / 10);
  });

  it('moves its hits with the paths and the probe', () => {
    fc.assert(fc.property(paths, fc.tuple(coord(80), coord(80)), query, fc.tuple(eighth(200), eighth(200)), (ps, [x, y], { radius, sx, sy }, [tx, ty]) => {
      const q = { radius, scale: { x: sx, y: sy }, kinds: PATH_SNAP_KINDS.filter((k) => k !== 'tangent' && k !== 'perpendicular') };
      const a = findPathSnap(createPathSnapIndex(ps), { x, y }, q);
      const moved: Path[] = ps.map((p) => transformPath(p, translate(tx, ty)));
      const b = findPathSnap(createPathSnapIndex(moved), { x: x + tx, y: y + ty }, q);
      // Paths hold float32 coordinates, so a hit at the edge of the radius may fall either side of it.
      if (a && Math.abs(a.distance - radius) < 1e-2) return;
      if (!a) { if (b) expect(b.distance).toBeGreaterThan(radius - 1e-2); return; }
      expect(b).not.toBeNull();
      expect(Math.abs(b!.distance - a.distance)).toBeLessThan(1e-2);
    }), RUNS);
  });
});
