import { describe, it, expect } from 'vitest';
import { resolveSnap, type Flat, type SnapCandidate, type SnapProblem, type Vec } from '../nd';

const identity = (w: Vec): Vec => w;
const plane2: Flat = { at: [0, 0], dirs: [[1, 0], [0, 1]] };
const origin = { id: 'o', at: [0, 0], role: 'origin' as const };

let nextOrder = 0;
function cand(locus: Flat, extra: Partial<SnapCandidate<string>> = {}): SnapCandidate<string> {
  const order = nextOrder++;
  return {
    probe: 'o', locus, source: 'test', order, tier: 'target', reachPx: 8, mark: `m${order}`, ...extra,
  };
}
const vline = (x: number): Flat => ({ at: [x, 0], dirs: [[0, 1]] });
const hline = (y: number): Flat => ({ at: [0, y], dirs: [[1, 0]] });
const point = (x: number, y: number): Flat => ({ at: [x, y], dirs: [] });

function problem(p: Partial<SnapProblem<string>>): SnapProblem<string> {
  return { probes: [origin], input: plane2, delta0: [0, 0], candidates: [], toScreen: identity, ...p };
}

function expectVecClose(a: Vec, b: Vec, digits = 9) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], digits);
}

describe('resolveSnap', () => {
  it('point beats a nearer line', () => {
    const pt = cand(point(6, 0));
    const line = cand(vline(2));
    const r = resolveSnap(problem({ candidates: [line, pt] }));
    expectVecClose(r.delta, [6, 0]);
    expect(r.codim).toBe(2);
    expect(r.members).toEqual([pt]);
  });

  it('two lines on different probes combine', () => {
    const probes = [
      { id: 'box.min', at: [0, 0], role: 'box' as const },
      { id: 'box.max', at: [10, 10], role: 'box' as const },
    ];
    const x = cand(vline(10), { probe: 'box.min' });
    const y = cand(hline(20), { probe: 'box.max' });
    const r = resolveSnap(problem({ probes, delta0: [9, 11], candidates: [x, y] }));
    expectVecClose(r.delta, [10, 10]);
    expect(r.codim).toBe(2);
    expect(new Set(r.members)).toEqual(new Set([x, y]));
  });

  it('fallback never displaces a target', () => {
    const gridX = cand(vline(1.5), { tier: 'fallback', reachPx: Infinity });
    const gridY = cand(hline(0), { tier: 'fallback', reachPx: Infinity });
    const target = cand(vline(7.5));
    const r = resolveSnap(problem({ delta0: [0.5, 0.3], candidates: [gridX, gridY, target] }));
    expectVecClose(r.delta, [7.5, 0]);
    expect(new Set(r.members)).toEqual(new Set([target, gridY]));
  });

  it('nothing in reach returns delta0 projected into H', () => {
    const r = resolveSnap(problem({
      input: { at: [0, 0], dirs: [[1, 1]] },
      delta0: [3, 1],
      candidates: [cand(vline(100))],
    }));
    expectVecClose(r.delta, [2, 2]);
    expect(r.codim).toBe(0);
    expect(r.members).toEqual([]);
    expect(r.satisfied).toEqual([]);
  });

  it('H intersection: a 15° line meets a vertical guide', () => {
    const t = Math.tan(Math.PI / 12);
    const guide = cand(vline(10));
    const r = resolveSnap(problem({
      input: { at: [0, 0], dirs: [[Math.cos(Math.PI / 12), Math.sin(Math.PI / 12)]] },
      delta0: [9, 9 * t],
      candidates: [guide],
    }));
    expectVecClose(r.delta, [10, 10 * t]);
    expect(r.codim).toBe(1);
    expect(r.members).toEqual([guide]);
  });

  it('reach is measured from delta0 projected into H', () => {
    const a = Math.PI / 12;
    const u = [Math.cos(a), Math.sin(a)];
    const n = [-Math.sin(a), Math.cos(a)];
    const seen = [20 * u[0], 20 * u[1]];
    // 5px along H from the point the user sees; 20px off H from the raw δ0.
    const gx = seen[0] + 5 * Math.cos(a);
    const guide = cand(vline(gx));
    const r = resolveSnap(problem({
      input: { at: [0, 0], dirs: [u] },
      delta0: [seen[0] + 20 * n[0], seen[1] + 20 * n[1]],
      candidates: [guide],
    }));
    expectVecClose(r.delta, [gx, gx * Math.tan(a)]);
    expect(r.members).toEqual([guide]);
  });

  it('span rejects off-segment solutions', () => {
    const seg = cand(hline(5), { span: [[0, 10]] });
    expectVecClose(resolveSnap(problem({ delta0: [15, 4], candidates: [seg] })).delta, [15, 4]);
    expectVecClose(resolveSnap(problem({ delta0: [5, 4], candidates: [seg] })).delta, [5, 5]);

    // Each fits alone; together they meet at x=11, off the segment.
    const guide = cand(vline(11));
    const r = resolveSnap(problem({ delta0: [9.5, 4.5], candidates: [seg, guide] }));
    expectVecClose(r.delta, [9.5, 5]);
    expect(r.members).toEqual([seg]);
  });

  it('required forces a member', () => {
    const line1: Flat = { at: [0], dirs: [[1]] };
    const radius = 100;
    const toScreen = (w: Vec): Vec => [w[0] * radius];
    const step = Math.PI / 12;
    const steps = Array.from({ length: 25 }, (_, i) =>
      cand({ at: [(i - 12) * step], dirs: [] }, { source: 'step', required: true }));
    const near = cand({ at: [0.35], dirs: [] });
    const base = { probes: [{ id: 'o', at: [0], role: 'pointer' as const }], input: line1, toScreen };

    const free = resolveSnap({ ...base, delta0: [0.33], candidates: [near] });
    expectVecClose(free.delta, [0.35]);

    const r = resolveSnap({ ...base, delta0: [0.33], candidates: [near, ...steps] });
    expectVecClose(r.delta, [step]);
    expect(r.members.some((m) => m.required)).toBe(true);

    // Out of reach still applies to nothing required: 0.39 is 12.8px from the nearest step.
    const far = resolveSnap({ ...base, delta0: [0.39], candidates: steps });
    expectVecClose(far.delta, [step]);
  });

  it('degenerate inputs return finite numbers', () => {
    const zeroDir = cand({ at: [3, 0], dirs: [[0, 0]] });
    const r1 = resolveSnap(problem({ delta0: [2, 0], candidates: [zeroDir] }));
    expectVecClose(r1.delta, [3, 0]);

    const a = cand(vline(3));
    const b = cand(vline(3), { source: 'other' });
    const r2 = resolveSnap(problem({ delta0: [2, 1], candidates: [a, b] }));
    expectVecClose(r2.delta, [3, 1]);
    expect(r2.members).toHaveLength(1);
    expect(r2.codim).toBe(1);

    const behind = (w: Vec): Vec => (w[0] > 5 ? [NaN, NaN] : w);
    const r3 = resolveSnap(problem({ delta0: [4, 0], toScreen: behind, candidates: [cand(vline(6))] }));
    expectVecClose(r3.delta, [4, 0]);

    const r4 = resolveSnap(problem({ delta0: [4, 0], toScreen: () => [NaN, NaN], candidates: [cand(vline(4.5))] }));
    expectVecClose(r4.delta, [4, 0]);

    const unlimited = cand(vline(6), { tier: 'fallback', reachPx: Infinity });
    const r5 = resolveSnap(problem({ delta0: [4, 0], toScreen: behind, candidates: [unlimited] }));
    expectVecClose(r5.delta, [4, 0]);
    expect(r5.members).toEqual([]);
    expect(r5.satisfied).toEqual([]);

    for (const r of [r1, r2, r3, r4, r5]) for (const v of r.delta) expect(Number.isFinite(v)).toBe(true);
  });

  it('drops a candidate with a non-finite locus dir rather than reading it as a point', () => {
    const broken = cand({ at: [3, 0], dirs: [[NaN, 1]] });
    expectVecClose(resolveSnap(problem({ delta0: [2, 5], candidates: [broken] })).delta, [2, 5]);
  });

  it('pools the nearest poolSize candidates per probe', () => {
    const line = cand(vline(1));
    const pt = cand(point(3, 3));
    expectVecClose(resolveSnap(problem({ candidates: [line, pt] })).delta, [3, 3]);
    expectVecClose(resolveSnap(problem({ candidates: [line, pt], poolSize: 1 })).delta, [1, 0]);
  });

  it('keeps every required candidate past the pool, however many nearer ones there are', () => {
    const near = cand(point(1, 0));
    const required = cand(point(6, 0), { required: true });
    const r = resolveSnap(problem({ candidates: [near, required], poolSize: 1 }));
    expectVecClose(r.delta, [6, 0]);
    expect(r.members).toEqual([required]);
  });

  it('meets a line across a 3D input plane at the point where they cross', () => {
    const ground: Flat = { at: [0, 0, 0], dirs: [[1, 0, 0], [0, 0, 1]] };
    const post = cand({ at: [2, 5, 1], dirs: [[0, 1, 0]] });
    const r = resolveSnap({
      probes: [{ id: 'o', at: [0, 0, 0], role: 'origin' }], input: ground, delta0: [1.5, 0, 0.8],
      candidates: [post], toScreen: identity,
    });
    expectVecClose(r.delta, [2, 0, 1]);
    expect(r.codim).toBe(2);
  });

  it('satisfied lists every coincident in-reach candidate', () => {
    const lines = [cand(hline(5)), cand(hline(5), { source: 's2' }), cand(hline(5), { source: 's3' })];
    const far = cand(vline(50));
    const r = resolveSnap(problem({ delta0: [0, 4], candidates: [...lines, far] }));
    expectVecClose(r.delta, [0, 5]);
    expect(r.members).toHaveLength(1);
    expect(new Set(r.satisfied)).toEqual(new Set(lines));
  });
});
