import { describe, expect, it } from 'vitest';
import {
  eulerAngleAt, eulerCurvatureAt, eulerCurvatureDerivativesAt, eulerPointAt, fitEulerSegment,
  placeEulerSegment, subEulerSegment, type EulerSegment,
} from './eulerSpiral';
import { solveSpiro, type SpiroKind, type SpiroPoint } from './spiro';
import { spiroToPath } from './spiroPath';

const pts = (kinds: SpiroKind | SpiroKind[], ...xy: [number, number][]): SpiroPoint[] =>
  xy.map(([x, y], i) => ({ x, y, kind: Array.isArray(kinds) ? kinds[i] : kinds }));

const TAU = Math.PI * 2;
const angleGap = (a: number, b: number) => Math.abs(a - b - TAU * Math.round((a - b) / TAU));

/** How far each of angle, curvature, and curvature's first two derivatives
 *  jumps where `a` ends and `b` begins, each relative to its own scale. */
function jumps(a: EulerSegment, b: EulerSegment): number[] {
  const scale = (a.length + b.length) / 2;
  const [a1, a2] = eulerCurvatureDerivativesAt(a, 1);
  const [b1, b2] = eulerCurvatureDerivativesAt(b, 0);
  return [
    angleGap(eulerAngleAt(a, 1), eulerAngleAt(b, 0)),
    Math.abs(eulerCurvatureAt(a, 1) - eulerCurvatureAt(b, 0)) * scale,
    Math.abs(a1 - b1) * scale ** 2,
    Math.abs(a2 - b2) * scale ** 3,
  ];
}

describe('cubic-curvature segments', () => {
  it('leave and arrive at the angles asked for, whatever their higher terms', () => {
    const fit = fitEulerSegment(0.5, -0.2, 3, -20);
    expect(fit.k2).toBe(3);
    expect(fit.k3).toBe(-20);
    const seg = placeEulerSegment(fit, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(eulerAngleAt(seg, 0)).toBeCloseTo(0.5, 6);
    expect(eulerAngleAt(seg, 1)).toBeCloseTo(-0.2, 6);
    const end = eulerPointAt(seg, 1);
    expect(end.x).toBeCloseTo(100, 6);
    expect(end.y).toBeCloseTo(0, 6);
  });

  it('are Euler spirals when the higher terms are zero', () => {
    const fit = fitEulerSegment(0.4, 0.1);
    expect(fit.k2).toBe(0);
    expect(fit.k3).toBe(0);
    const seg = placeEulerSegment(fit, { x: 0, y: 0 }, { x: 50, y: 10 });
    const [d1, d2] = eulerCurvatureDerivativesAt(seg, 0.3);
    expect(d1).toBeCloseTo(fit.k1 / seg.length ** 2, 12);
    expect(d2).toBe(0);
  });

  it('cut into pieces that lie on the whole', () => {
    const seg = placeEulerSegment(fitEulerSegment(0.6, 0.3, -4, 30), { x: 0, y: 0 }, { x: 80, y: 20 });
    const piece = subEulerSegment(seg, 0.25, 0.75);
    for (const s of [0, 0.3, 0.6, 1]) {
      const p = eulerPointAt(piece, s);
      const q = eulerPointAt(seg, 0.25 + 0.5 * s);
      expect(p.x).toBeCloseTo(q.x, 4);
      expect(p.y).toBeCloseTo(q.y, 4);
      expect(eulerCurvatureAt(piece, s)).toBeCloseTo(eulerCurvatureAt(seg, 0.25 + 0.5 * s), 7);
    }
  });
});

describe('solveSpiro with g4 points', () => {
  it('carries the curvature and its first two derivatives through every g4 point', () => {
    const segs = solveSpiro(pts('g4', [0, 0], [80, 60], [170, 20], [260, 90], [300, 200]), false);
    for (let i = 0; i + 1 < segs.length; i++) {
      for (const jump of jumps(segs[i].spiral!, segs[i + 1].spiral!)) expect(jump).toBeLessThan(1e-7);
    }
  });

  it('runs four g4 points of a square round a circle', () => {
    const segs = solveSpiro(pts('g4', [100, 0], [0, 100], [-100, 0], [0, -100]), true);
    for (const seg of segs) {
      for (let i = 0; i <= 10; i++) {
        const p = eulerPointAt(seg.spiral!, i / 10);
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 4);
      }
    }
  });

  it('holds each point to its own kind when g4 and smooth points mix', () => {
    const kinds: SpiroKind[] = ['g4', 'smooth', 'g4', 'g4', 'smooth', 'corner'];
    const segs = solveSpiro(pts(kinds, [0, 0], [60, 80], [140, 60], [200, 120], [260, 60], [320, 140]), true);
    for (let i = 0; i < kinds.length; i++) {
      const a = segs[(i - 1 + kinds.length) % kinds.length].spiral!;
      const b = segs[i].spiral!;
      const [angle, bend, d1, d2] = jumps(a, b);
      if (kinds[i] === 'corner') {
        expect(Math.abs(eulerCurvatureAt(a, 1))).toBeLessThan(1e-7);
        expect(Math.abs(eulerCurvatureAt(b, 0))).toBeLessThan(1e-7);
        continue;
      }
      expect(angle).toBeLessThan(1e-7);
      expect(bend).toBeLessThan(1e-7);
      if (kinds[i] === 'g4') {
        expect(d1).toBeLessThan(1e-7);
        expect(d2).toBeLessThan(1e-7);
      }
    }
  });

  it('bends more evenly than smooth points do through the same places', () => {
    const at: [number, number][] = [[0, 0], [100, 0], [150, 80], [100, 160], [40, 120]];
    const g2 = solveSpiro(pts('smooth', ...at), false);
    const g4 = solveSpiro(pts('g4', ...at), false);
    const slopeJump = (segs: typeof g2) => Math.max(...segs.slice(1).map((s, i) =>
      Math.abs(eulerCurvatureDerivativesAt(segs[i].spiral!, 1)[0] - eulerCurvatureDerivativesAt(s.spiral!, 0)[0])));
    expect(slopeJump(g4)).toBeLessThan(1e-9);
    expect(slopeJump(g2)).toBeGreaterThan(1e-6);
  });

  it('writes a g4 curve as cubics through its points', () => {
    const points = pts('g4', [0, 0], [80, 60], [170, 20], [260, 90]);
    const { path, at } = spiroToPath([{ points, closed: false }]);
    expect(at).toHaveLength(4);
    expect(path.commands.length).toBeGreaterThan(3);
  });
});
