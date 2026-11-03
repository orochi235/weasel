import { describe, expect, it } from 'vitest';
import { compose, quatIdentity, type Vec3 } from '@weasel-js/geom/3d';
import { HEAD } from './head';
import {
  LINE_FLOATS, ROLE_BACK, ROLE_HEAD_BASE, ROLE_SHAFT_END, ROLE_TIP, packLines, visibleRuns, type Line3,
} from './pack';

const v = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z });
const INK = [1, 0, 0, 1] as const;
const line = (points: Vec3[], more: Partial<Line3> = {}): Line3 => ({ runs: [{ points }], color: INK, ...more });

const vertices = (a: Float32Array): number[][] =>
  Array.from({ length: a.length / LINE_FLOATS }, (_, i) => Array.from(a.slice(i * LINE_FLOATS, (i + 1) * LINE_FLOATS)));
const role = (vtx: number[]) => vtx[9];

describe('visibleRuns', () => {
  it('keeps the whole line without a trim', () => {
    expect(visibleRuns(line([v(0), v(10)]))).toEqual([{ points: [v(0), v(10)], closed: false, headed: true }]);
  });

  it('cuts both ends where the trim says, by length', () => {
    const [run] = visibleRuns(line([v(0), v(4), v(4, 6)], { trim: { start: 0.2, end: 0.7 } }));
    // 10 units long: from 2 along x, past the corner, to 3 up the second leg.
    expect(run.points).toEqual([v(2), v(4), v(4, 3)]);
  });

  it('measures by anchor when the pace says so', () => {
    const [run] = visibleRuns(line([v(0), v(1), v(11)], { trim: { end: 0.75, pace: 'anchor' } }));
    expect(run.points[1]).toEqual(v(1));
    expect(run.points[2].x).toBeCloseTo(6);
  });

  it('draws nothing for an empty window', () => {
    expect(visibleRuns(line([v(0), v(10)], { trim: { start: 0.6, end: 0.4 } }))).toEqual([]);
  });

  it('measures in the line’s own space, before its model', () => {
    const model = compose(v(0), quatIdentity(), v(3, 3, 3));
    const [run] = visibleRuns(line([v(0), v(10)], { trim: { end: { length: 5 } }, model }));
    expect(run.points[1]).toEqual(v(5));
  });

  it('keeps a closed subpath the window covers whole closed, and headless', () => {
    const square = [v(0), v(1), v(1, 1), v(0, 1)];
    expect(visibleRuns({ runs: [{ points: square, closed: true }], color: INK }))
      .toEqual([{ points: square, closed: true, headed: false }]);
  });

  it('opens a closed subpath the window cuts, with no head on it', () => {
    const square = [v(0), v(1), v(1, 1), v(0, 1)];
    const [run] = visibleRuns({ runs: [{ points: square, closed: true }], color: INK, trim: { end: 0.5 } });
    expect(run).toEqual({ points: [v(0), v(1), v(1, 1)], closed: false, headed: false });
  });

  it('gives each subpath the window reaches a run, and each open one a head', () => {
    const runs = [{ points: [v(0), v(2)] }, { points: [v(0, 5), v(2, 5)] }];
    const out = visibleRuns({ runs, color: INK, trim: { start: 0.25, end: 0.75 } });
    expect(out.map((r) => r.points)).toEqual([[v(1), v(2)], [v(0, 5), v(1, 5)]]);
    expect(out.every((r) => r.headed)).toBe(true);
  });

  it('heads no run when the line has no head', () => {
    expect(visibleRuns(line([v(0), v(1)], { head: null }))[0].headed).toBe(false);
  });
});

describe('packLines', () => {
  it('packs a straight headed line as a shaft quad and a head', () => {
    const vs = vertices(packLines([line([v(0), v(10)])]));
    expect(vs.map(role)).toEqual([
      ROLE_BACK, ROLE_BACK, ROLE_SHAFT_END, ROLE_BACK, ROLE_SHAFT_END, ROLE_SHAFT_END,
      ROLE_HEAD_BASE, ROLE_HEAD_BASE, ROLE_TIP,
    ]);
    for (const vtx of vs) expect(vtx.slice(0, 6)).toEqual([0, 0, 0, 10, 0, 0]);
  });

  it('puts the head on the last segment alone', () => {
    const vs = vertices(packLines([line([v(0), v(1), v(2)])]));
    expect(vs).toHaveLength(6 + 9);
    expect(vs.slice(0, 6).every((x) => role(x) < ROLE_HEAD_BASE)).toBe(true);
  });

  it('packs a headless line as shaft alone', () => {
    const vs = vertices(packLines([line([v(0), v(1), v(2)], { head: null })]));
    expect(vs).toHaveLength(12);
    expect(vs.every((x) => x[15] === 0)).toBe(true);
  });

  it('carries each vertex the neighbor past its own end, a free end itself', () => {
    const vs = vertices(packLines([line([v(0), v(1), v(2, 1), v(3, 1)], { head: null })]));
    const adj = (seg: number, r: number) => vs.slice(seg * 6, seg * 6 + 6).find((x) => role(x) === r)!.slice(6, 9);
    expect(adj(1, ROLE_BACK)).toEqual([0, 0, 0]);
    expect(adj(1, ROLE_SHAFT_END)).toEqual([3, 1, 0]);
    expect(adj(0, ROLE_BACK)).toEqual([0, 0, 0]);
    expect(adj(2, ROLE_SHAFT_END)).toEqual([3, 1, 0]);
  });

  it('wraps a closed run’s neighbors round its closing edge', () => {
    const square = [v(0), v(1), v(1, 1), v(0, 1)];
    const vs = vertices(packLines([{ runs: [{ points: square, closed: true }], color: INK }]));
    expect(vs).toHaveLength(4 * 6);
    expect(vs[0].slice(6, 9)).toEqual([0, 1, 0]);
    expect(vs.at(-1)!.slice(0, 6)).toEqual([0, 1, 0, 0, 0, 0]);
  });

  it('carries the length along the run, not 0 and 1 a segment', () => {
    const vs = vertices(packLines([line([v(0), v(1), v(3), v(4)], { head: null })]));
    expect([0, 6, 12].map((i) => vs[i].slice(11, 14))).toEqual([[0, 1, 4], [1, 3, 4], [3, 4, 4]]);
  });

  it('gives every vertex of a run the tip, its last segment’s start and that segment’s length', () => {
    const vs = vertices(packLines([line([v(0), v(1), v(3)])]));
    for (const x of vs) expect(x.slice(18, 25)).toEqual([3, 0, 0, 1, 0, 0, 2]);
  });

  it('carries the width as half a shaft, the head shape and the color', () => {
    const [x] = vertices(packLines([line([v(0), v(1)], { width: 6, color: [0.25, 0.5, 0.75, 1] })]));
    expect(x.slice(14, 18)).toEqual([3, HEAD.lenRatio, HEAD.maxShare, Math.fround(HEAD.aspect)]);
    expect(x.slice(25, 29)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('places points in the world through the model, lengths staying the line’s own', () => {
    const model = compose(v(10), quatIdentity(), v(2, 2, 2));
    const [x] = vertices(packLines([line([v(0), v(1)], { model })]));
    expect(x.slice(0, 6)).toEqual([10, 0, 0, 12, 0, 0]);
    expect(x.slice(11, 14)).toEqual([0, 1, 1]);
  });

  it('packs nothing for a line of one point', () => {
    expect(packLines([line([v(2, 2, 2)])])).toHaveLength(0);
  });
});
