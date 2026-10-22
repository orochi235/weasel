import { describe, it, expect } from 'vitest';
import { intersectRayAabb } from '../3d/ray3';
import { bvhMaxDepth, createBvh, type BoxN, type HalfSpace } from './bvh';

/** mulberry32 — a small deterministic PRNG so failures reproduce. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBox(r: () => number, dim: number, span = 1000, size = 40): number[] {
  const b = new Array<number>(2 * dim);
  for (let i = 0; i < dim; i++) {
    const lo = r() * span;
    // Some degenerate (zero-extent) boxes, to exercise touching boundaries.
    const ext = r() < 0.1 ? 0 : r() * size;
    b[i] = lo;
    b[dim + i] = lo + ext;
  }
  return b;
}

function overlaps(a: BoxN, b: BoxN, dim: number): boolean {
  for (let i = 0; i < dim; i++) if (a[i] > b[dim + i] || b[i] > a[dim + i]) return false;
  return true;
}

function slab(box: BoxN, dim: number, o: number[], d: number[], tMax: number): number {
  let near = 0;
  let far = tMax;
  for (let i = 0; i < dim; i++) {
    if (d[i] === 0) {
      if (o[i] < box[i] || o[i] > box[dim + i]) return -1;
      continue;
    }
    const inv = 1 / d[i];
    let t1 = (box[i] - o[i]) * inv;
    let t2 = (box[dim + i] - o[i]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return -1;
  }
  return near;
}

function outsideAny(box: BoxN, dim: number, planes: readonly HalfSpace[]): boolean {
  return planes.some((pl) => {
    let s = pl.offset;
    for (let i = 0; i < dim; i++) s += pl.normal[i] * (pl.normal[i] >= 0 ? box[dim + i] : box[i]);
    return s < 0;
  });
}

function insideAll(box: BoxN, dim: number, planes: readonly HalfSpace[]): boolean {
  return planes.every((pl) => {
    let s = pl.offset;
    for (let i = 0; i < dim; i++) s += pl.normal[i] * (pl.normal[i] >= 0 ? box[i] : box[dim + i]);
    return s >= 0;
  });
}

function collect<K>(fn: (visit: (k: K) => void) => void): K[] {
  const out: K[] = [];
  fn((k) => { out.push(k); });
  return out.sort();
}

function populate(dim: number, n: number, seed: number) {
  const r = rng(seed);
  const boxes = new Map<number, number[]>();
  for (let i = 0; i < n; i++) boxes.set(i, randomBox(r, dim));
  return { r, boxes };
}

function brute(boxes: Map<number, number[]>, pred: (b: number[]) => boolean): number[] {
  return [...boxes].filter(([, b]) => pred(b)).map(([k]) => k).sort();
}

describe('createBvh', () => {
  for (const dim of [2, 3]) {
    describe(`dim ${dim}`, () => {
      it('queryBox matches a brute-force overlap scan', () => {
        const { r, boxes } = populate(dim, 2000, 11 + dim);
        const built = createBvh<number>(dim, boxes);
        const inserted = createBvh<number>(dim);
        for (const [k, b] of boxes) expect(inserted.insert(k, b)).toBe(true);
        expect(built.size).toBe(2000);
        expect(inserted.size).toBe(2000);
        for (let q = 0; q < 200; q++) {
          const box = randomBox(r, dim, 1000, 200);
          const want = brute(boxes, (b) => overlaps(b, box, dim));
          expect(collect<number>((v) => built.queryBox(box, v))).toEqual(want);
          expect(collect<number>((v) => inserted.queryBox(box, v))).toEqual(want);
        }
      });

      it('queryPoint matches brute force', () => {
        const { r, boxes } = populate(dim, 2000, 23 + dim);
        const tree = createBvh<number>(dim, boxes);
        const keys = [...boxes.keys()];
        for (let q = 0; q < 200; q++) {
          // Half the probes sit on a box corner, so closed intervals are exercised.
          const p = q % 2 === 0
            ? Array.from({ length: dim }, () => r() * 1000)
            : boxes.get(keys[Math.floor(r() * keys.length)])!.slice(dim);
          const want = brute(boxes, (b) => overlaps(b, [...p, ...p], dim));
          expect(collect<number>((v) => tree.queryPoint(p, v))).toEqual(want);
        }
      });

      it('raycast visits in nondecreasing t and matches slab-test brute force', () => {
        const { r, boxes } = populate(dim, 2000, 37 + dim);
        const tree = createBvh<number>(dim, boxes);
        for (let q = 0; q < 200; q++) {
          const o = Array.from({ length: dim }, () => r() * 1200 - 100);
          const d = Array.from({ length: dim }, () => (r() < 0.15 ? 0 : r() * 2 - 1));
          const tMax = q % 3 === 0 ? 300 : Infinity;
          const want = new Map<number, number>();
          for (const [k, b] of boxes) {
            const t = slab(b, dim, o, d, tMax);
            if (t >= 0) want.set(k, t);
          }
          const got: [number, number][] = [];
          tree.raycast(o, d, (k, t) => { got.push([k, t]); }, q % 3 === 0 ? tMax : undefined);
          for (let i = 1; i < got.length; i++) expect(got[i][1]).toBeGreaterThanOrEqual(got[i - 1][1]);
          expect(got.map(([k]) => k).sort()).toEqual([...want.keys()].sort());
          for (const [k, t] of got) expect(t).toBeCloseTo(want.get(k)!, 9);
        }
      });

      it('queryHalfSpaces never drops a box inside all planes', () => {
        const { r, boxes } = populate(dim, 2000, 41 + dim);
        const tree = createBvh<number>(dim, boxes);
        for (let q = 0; q < 200; q++) {
          const planes: HalfSpace[] = Array.from({ length: 4 }, () => {
            const normal = Array.from({ length: dim }, () => r() * 2 - 1);
            const at = Array.from({ length: dim }, () => r() * 1000);
            return { normal, offset: -normal.reduce((s, n, i) => s + n * at[i], 0) };
          });
          const got = new Set(collect<number>((v) => tree.queryHalfSpaces(planes, v)));
          for (const [k, b] of boxes) {
            if (insideAll(b, dim, planes)) expect(got.has(k)).toBe(true);
            if (outsideAny(b, dim, planes)) expect(got.has(k)).toBe(false);
          }
        }
      });
    });
  }

  it('update moves a box and the old position no longer answers', () => {
    const tree = createBvh<string>(2, [['a', [0, 0, 10, 10]], ['b', [50, 50, 60, 60]]]);
    expect(tree.update('a', [100, 100, 110, 110])).toBe(true);
    expect(collect<string>((v) => tree.queryPoint([5, 5], v))).toEqual([]);
    expect(collect<string>((v) => tree.queryPoint([105, 105], v))).toEqual(['a']);
    expect(tree.update('missing', [0, 0, 1, 1])).toBe(false);
    expect(tree.size).toBe(2);
  });

  it('remove drops it', () => {
    const { boxes } = populate(2, 300, 5);
    const tree = createBvh<number>(2, boxes);
    for (let k = 0; k < 300; k += 2) {
      expect(tree.remove(k)).toBe(true);
      boxes.delete(k);
    }
    expect(tree.remove(0)).toBe(false);
    expect(tree.size).toBe(150);
    const all = [-1, -1, 2000, 2000];
    expect(collect<number>((v) => tree.queryBox(all, v))).toEqual([...boxes.keys()].sort());
    for (const k of [...boxes.keys()]) tree.remove(k);
    expect(tree.size).toBe(0);
    expect(collect<number>((v) => tree.queryBox(all, v))).toEqual([]);
  });

  it('insert refuses NaN / Infinity / inverted boxes and returns false', () => {
    const tree = createBvh<string>(2);
    expect(tree.insert('nan', [0, NaN, 1, 1])).toBe(false);
    expect(tree.insert('inf', [0, 0, Infinity, 1])).toBe(false);
    expect(tree.insert('-inf', [-Infinity, 0, 1, 1])).toBe(false);
    expect(tree.insert('inverted', [5, 0, 1, 1])).toBe(false);
    expect(tree.insert('short', [0, 0, 1])).toBe(false);
    expect(tree.size).toBe(0);
    expect(tree.insert('ok', [0, 0, 0, 0])).toBe(true);
    expect(tree.update('ok', [0, 0, NaN, 1])).toBe(false);
    expect(collect<string>((v) => tree.queryPoint([0, 0], v))).toEqual(['ok']);
  });

  it('refit after many updates still matches brute force', () => {
    const { r, boxes } = populate(2, 2000, 77);
    const tree = createBvh<number>(2, boxes);
    for (let round = 0; round < 5; round++) {
      for (const [k, b] of boxes) {
        // Mostly small nudges (in-place writes), some long jumps (reinsertions).
        const jump = r() < 0.1 ? r() * 800 - 400 : r() * 4 - 2;
        const moved = b.map((c) => c + jump);
        boxes.set(k, moved);
        expect(tree.update(k, moved)).toBe(true);
      }
      tree.refit();
      for (let q = 0; q < 40; q++) {
        const box = randomBox(r, 2, 1000, 200);
        expect(collect<number>((v) => tree.queryBox(box, v))).toEqual(brute(boxes, (b) => overlaps(b, box, 2)));
      }
    }
  });

  it('rebuild gives the same answers', () => {
    const { r, boxes } = populate(3, 2000, 91);
    const tree = createBvh<number>(3);
    for (const [k, b] of boxes) tree.insert(k, b);
    const queries = Array.from({ length: 50 }, () => randomBox(r, 3, 1000, 200));
    const before = queries.map((q) => collect<number>((v) => tree.queryBox(q, v)));
    tree.rebuild();
    expect(tree.size).toBe(2000);
    expect(queries.map((q) => collect<number>((v) => tree.queryBox(q, v)))).toEqual(before);
  });

  it('empty tree answers nothing', () => {
    const tree = createBvh<number>(3);
    let hits = 0;
    const count = () => { hits++; };
    tree.queryBox([0, 0, 0, 1, 1, 1], count);
    tree.queryPoint([0, 0, 0], count);
    tree.raycast([0, 0, 0], [1, 0, 0], count);
    tree.queryHalfSpaces([], count);
    tree.refit();
    tree.rebuild();
    expect(hits).toBe(0);
    expect(tree.size).toBe(0);
    expect(tree.dim).toBe(3);
  });

  it('visit returning false stops the query', () => {
    const tree = createBvh<number>(2, Array.from({ length: 100 }, (_, i) => [i, [0, 0, 1, 1]] as const));
    let n = 0;
    tree.queryBox([0, 0, 1, 1], () => ++n < 3);
    expect(n).toBe(3);
    n = 0;
    tree.raycast([-1, 0.5], [1, 0], () => ++n < 5);
    expect(n).toBe(5);
  });

  it('a query from inside a visit sees the whole tree', () => {
    const tree = createBvh<number>(2, Array.from({ length: 50 }, (_, i) => [i, [i, 0, i + 1, 1]] as const));
    const inner: number[] = [];
    let outer = 0;
    tree.queryBox([0, 0, 100, 1], () => {
      outer++;
      if (outer === 1) tree.queryBox([0, 0, 100, 1], (k) => { inner.push(k); });
    });
    expect(outer).toBe(50);
    expect(inner.length).toBe(50);
  });

  describe('depth stays bounded under adversarial insert orders', () => {
    // After any insert a leaf is at most 2*ceil(log2 n) deep; removals can
    // leave the limit of the peak size, at most twice n, which adds 2.
    const bound = (n: number) => 2 * Math.ceil(Math.log2(n)) + 2;
    const N = 10_000;

    function check(make: (i: number) => number[]) {
      const tree = createBvh<number>(2);
      const boxes = new Map<number, number[]>();
      for (let i = 0; i < N; i++) {
        const b = make(i);
        boxes.set(i, b);
        tree.insert(i, b);
        if ((i + 1) % 1000 === 0) expect(bvhMaxDepth(tree)).toBeLessThanOrEqual(bound(i + 1));
      }
      const r = rng(3);
      for (let q = 0; q < 50; q++) {
        const box = randomBox(r, 2, N, 300);
        expect(collect<number>((v) => tree.queryBox(box, v))).toEqual(brute(boxes, (b) => overlaps(b, box, 2)));
      }
      for (let i = 0; i < N; i++) if (i % 4 !== 0) { tree.remove(i); boxes.delete(i); }
      expect(bvhMaxDepth(tree)).toBeLessThanOrEqual(bound(tree.size));
      const all = [-1, -1, N + 10, N + 10];
      expect(collect<number>((v) => tree.queryBox(all, v))).toEqual([...boxes.keys()].sort());
    }

    it('sorted boxes inserted one by one', () => check((i) => [i, 0, i + 0.5, 1]));
    it('coincident boxes inserted one by one', () => check(() => [5, 5, 6, 6]));
  });

  it('raycast survives a denormal direction component', () => {
    const tree = createBvh<string>(2, [['a', [0, 0, 10, 10]], ['b', [20, 0, 30, 10]]]);
    const got: [string, number][] = [];
    tree.raycast([0, -10], [5e-324, 1], (k, t) => { got.push([k, t]); });
    expect(got).toEqual([['a', 10]]);
  });

  it('raycast takes a ray through a box edge that intersectRayAabb takes', () => {
    // Aimed at the edge x = 0.7, z = 1.3; a reciprocal slab test rounds this ray out.
    const origin = { x: 9.125, y: 7.375, z: -5 };
    const direction = { x: 0.7 - origin.x, y: 0.3 - origin.y, z: 1.3 - origin.z };
    const min = { x: 0, y: 0, z: 0 };
    const max = { x: 0.7, y: 0.6, z: 1.3 };
    expect(intersectRayAabb({ origin, direction }, min, max)).toBe(1);
    const tree = createBvh<string>(3, [['a', [0, 0, 0, 0.7, 0.6, 1.3]]]);
    const got: [string, number][] = [];
    tree.raycast([origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z], (k, t) => { got.push([k, t]); });
    expect(got).toEqual([['a', 1]]);
  });

  it('raycast takes a denormal direction component the way intersectRayAabb does', () => {
    // The origin sits a denormal outside x's slab, so x enters at a finite t.
    const origin = { x: -1e-310, y: -10, z: 0 };
    const direction = { x: 5e-324, y: 1, z: 0 };
    const min = { x: 0, y: 0, z: -1 };
    const max = { x: 1, y: 3e13, z: 1 };
    const t = intersectRayAabb({ origin, direction }, min, max);
    expect(t).not.toBeNull();
    const tree = createBvh<string>(3, [['a', [0, 0, -1, 1, 3e13, 1]]]);
    const got: [string, number][] = [];
    tree.raycast([origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z], (k, ti) => { got.push([k, ti]); });
    expect(got).toEqual([['a', t]]);
  });

  it('inserting an existing key acts as update', () => {
    const tree = createBvh<string>(2, [['a', [0, 0, 1, 1]]]);
    expect(tree.insert('a', [50, 50, 51, 51])).toBe(true);
    expect(tree.size).toBe(1);
    expect(collect<string>((v) => tree.queryPoint([0.5, 0.5], v))).toEqual([]);
    expect(collect<string>((v) => tree.queryPoint([50.5, 50.5], v))).toEqual(['a']);
  });

  it('createBvh throws RangeError on a bad dim', () => {
    for (const dim of [0, -1, 1.5, NaN, Infinity]) expect(() => createBvh(dim)).toThrow(RangeError);
  });
});
