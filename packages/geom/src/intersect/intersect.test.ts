import { describe, expect, it } from 'vitest';
import { cubicEvalAt } from '../curve';
import { pathFromD } from '../paths/pathFromD';
import { intersectSegments } from './segmentIntersections';
import { pathCrossings } from './pathCrossings';

const P = (x: number, y: number) => ({ x, y });

describe('intersectSegments', () => {
  it('crosses two lines exactly', () => {
    const [h, ...rest] = intersectSegments([P(0, 0), P(10, 10)], [P(0, 10), P(10, 0)]);
    expect(rest).toHaveLength(0);
    expect(h).toMatchObject({ ta: 0.5, tb: 0.5, x: 5, y: 5 });
  });

  it('finds where a cubic crosses a line beyond its chord, its controls collinear with it', () => {
    // x(t) = 90t(1-t) + 10t³ runs out to ~23.7 and back to 10 along y = 0, so x = 20 is crossed twice.
    const cubic = [P(0, 0), P(30, 0), P(30, 0), P(10, 0)];
    const hits = intersectSegments(cubic, [P(20, -5), P(20, 5)]);
    expect(hits).toHaveLength(2);
    for (const h of hits) {
      expect(cubicEvalAt(0, 0, 30, 0, 30, 0, 10, 0, h.ta)[0]).toBeCloseTo(20, 6);
      expect(h.x).toBeCloseTo(20, 6);
    }
  });

  it('finds nothing between parallel lines', () => {
    expect(intersectSegments([P(0, 0), P(10, 0)], [P(0, 1), P(10, 1)])).toEqual([]);
  });

  it('reports where two collinear lines overlap, or touch end to end', () => {
    expect(intersectSegments([P(0, 0), P(10, 0)], [P(5, 0), P(15, 0)])).toEqual([
      { ta: 0.5, tb: 0, x: 5, y: 0 },
      { ta: 1, tb: 0.5, x: 10, y: 0 },
    ]);
    expect(intersectSegments([P(0, 0), P(10, 0)], [P(10, 0), P(15, 0)])).toEqual([{ ta: 1, tb: 0, x: 10, y: 0 }]);
    expect(intersectSegments([P(0, 0), P(10, 0)], [P(12, 0), P(15, 0)])).toEqual([]);
  });

  it('reports the overlap of collinear lines whose points only round onto one line', () => {
    const a = [P(17.305192039509542, 3.5068108953569044), P(24.697555959615823, 30.407665370937323)];
    const b = [P(19.522901215541427, 11.57706723803103), P(29.872210703690218, 49.23826350384362)];
    const hits = intersectSegments(a, b);
    expect(hits.map((h) => h.ta)).toEqual([expect.closeTo(0.3, 9), 1]);
    expect(hits.map((h) => h.tb)).toEqual([0, expect.closeTo(0.5, 9)]);
  });

  it('crosses a line and a cubic at a point on both', () => {
    const cubic = [P(0, 0), P(0, 20), P(20, 20), P(20, 0)];
    const hits = intersectSegments([P(-5, 10), P(25, 10)], cubic);
    expect(hits).toHaveLength(2);
    for (const h of hits) {
      expect(h.y).toBeCloseTo(10, 9);
      const [x, y] = cubicEvalAt(0, 0, 0, 20, 20, 20, 20, 0, h.tb);
      expect(x).toBeCloseTo(h.x, 9);
      expect(y).toBeCloseTo(h.y, 9);
    }
  });

  it('crosses two cubics where both pass', () => {
    const a = [P(0, 0), P(10, 30), P(20, -30), P(30, 0)];
    const b = [P(0, 5), P(10, -25), P(20, 35), P(30, 5)];
    const hits = intersectSegments(a, b);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const h of hits) {
      const [ax, ay] = cubicEvalAt(0, 0, 10, 30, 20, -30, 30, 0, h.ta);
      const [bx, by] = cubicEvalAt(0, 5, 10, -25, 20, 35, 30, 5, h.tb);
      expect(Math.hypot(ax - bx, ay - by)).toBeLessThan(1e-8);
    }
  });
});

describe('pathCrossings', () => {
  it('finds where two squares cross', () => {
    const a = pathFromD('M0 0 H20 V20 H0 Z');
    const b = pathFromD('M10 10 H30 V30 H10 Z');
    const pts = pathCrossings([a, b]).map((c) => [c.x, c.y]).sort();
    expect(pts).toEqual([[10, 20], [20, 10]]);
  });

  it('finds a path crossing itself, but not its joints', () => {
    const bowtie = pathFromD('M0 0 L20 20 L20 0 L0 20 Z');
    const self = pathCrossings([bowtie]);
    expect(self).toHaveLength(1);
    expect(self[0]).toMatchObject({ x: 10, y: 10 });
    expect(pathCrossings([bowtie], { self: false })).toHaveLength(0);
  });
});
