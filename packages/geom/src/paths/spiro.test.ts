import { describe, expect, it } from 'vitest';
import {
  eulerAngleAt, eulerCurvatureAt, eulerPointAt, fitEulerSegment, placeEulerSegment,
} from './eulerSpiral';
import { solveSpiro, type SpiroKind, type SpiroPoint } from './spiro';

const pts = (kinds: SpiroKind | SpiroKind[], ...xy: [number, number][]): SpiroPoint[] =>
  xy.map(([x, y], i) => ({ x, y, kind: Array.isArray(kinds) ? kinds[i] : kinds }));

const TAU = Math.PI * 2;
const angleGap = (a: number, b: number) => Math.abs(a - b - TAU * Math.round((a - b) / TAU));

describe('fitEulerSegment', () => {
  it('fits a circular arc when the end angles mirror each other', () => {
    const fit = fitEulerSegment(0.4, -0.4);
    expect(fit.k1).toBeCloseTo(0, 9);
    expect(fit.k0).toBeCloseTo(-0.8, 12);
  });

  it('leaves and arrives at the angles it was asked for', () => {
    const seg = placeEulerSegment(fitEulerSegment(0.7, 0.2), { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(eulerAngleAt(seg, 0)).toBeCloseTo(0.7, 6);
    expect(eulerAngleAt(seg, 1)).toBeCloseTo(0.2, 6);
    const end = eulerPointAt(seg, 1);
    expect(end.x).toBeCloseTo(100, 6);
    expect(end.y).toBeCloseTo(0, 6);
  });
});

describe('solveSpiro', () => {
  it('runs four smooth points of a square round a circle', () => {
    const segs = solveSpiro(pts('smooth', [100, 0], [0, 100], [-100, 0], [0, -100]), true);
    expect(segs).toHaveLength(4);
    for (const seg of segs) {
      for (let i = 0; i <= 10; i++) {
        const p = eulerPointAt(seg.spiral!, i / 10);
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 4);
      }
    }
  });

  it('carries tangent and curvature through every smooth point of an open curve', () => {
    const segs = solveSpiro(pts('smooth', [0, 0], [80, 60], [170, 20], [260, 90], [300, 200]), false);
    for (let i = 0; i + 1 < segs.length; i++) {
      const a = segs[i].spiral!;
      const b = segs[i + 1].spiral!;
      expect(angleGap(eulerAngleAt(a, 1), eulerAngleAt(b, 0))).toBeLessThan(1e-7);
      expect(Math.abs(eulerCurvatureAt(a, 1) - eulerCurvatureAt(b, 0))).toBeLessThan(1e-8);
    }
    // The free ends straighten out.
    expect(Math.abs(eulerCurvatureAt(segs[0].spiral!, 0))).toBeLessThan(1e-8);
    expect(Math.abs(eulerCurvatureAt(segs.at(-1)!.spiral!, 1))).toBeLessThan(1e-8);
  });

  it('lets a corner break the tangent', () => {
    const segs = solveSpiro(pts(['smooth', 'smooth', 'corner', 'smooth', 'smooth'],
      [0, 0], [60, 50], [120, 0], [180, 50], [240, 0]), false);
    expect(angleGap(eulerAngleAt(segs[1].spiral!, 1), eulerAngleAt(segs[2].spiral!, 0))).toBeGreaterThan(0.5);
    expect(Math.abs(eulerCurvatureAt(segs[1].spiral!, 1))).toBeLessThan(1e-8);
    expect(Math.abs(eulerCurvatureAt(segs[2].spiral!, 0))).toBeLessThan(1e-8);
  });

  it('draws collinear points as a straight line', () => {
    const segs = solveSpiro(pts('smooth', [0, 0], [50, 50], [100, 100]), false);
    for (const seg of segs) {
      expect(Math.abs(seg.spiral!.k0)).toBeLessThan(1e-9);
      expect(Math.abs(seg.spiral!.k1)).toBeLessThan(1e-9);
    }
  });

  it('runs a straight segment into a left point and leaves along its line', () => {
    const segs = solveSpiro(pts(['corner', 'left', 'smooth', 'smooth'], [0, 0], [100, 0], [180, 60], [200, 160]), false);
    expect(segs[0].spiral).toBeNull();
    expect(angleGap(eulerAngleAt(segs[1].spiral!, 0), 0)).toBeLessThan(1e-7);
  });

  it('runs the curve arriving at a right point into the straight segment leaving it', () => {
    const segs = solveSpiro(pts(['smooth', 'smooth', 'right', 'corner'], [0, 160], [20, 60], [100, 0], [200, 0]), false);
    expect(segs[2].spiral).toBeNull();
    expect(angleGap(eulerAngleAt(segs[1].spiral!, 1), 0)).toBeLessThan(1e-7);
  });
});

