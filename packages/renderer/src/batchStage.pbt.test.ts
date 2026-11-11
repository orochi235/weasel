/**
 * Staging cut to a clip, against a reference clipper in doubles: a run of quads and meshes pushed under a rect, a
 * convex clip, or both keeps each item in push order, covers exactly what the item covers inside the clip, carries
 * every attribute affinely to the cut corners, and stages nothing for an item it refuses.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { batchCut, cutKeeps, ringPlanes, type BatchCut, type ClipRect } from './batchClip';
import { BatchStage, FLOATS_PER_VERTEX as F } from './batchStage';
import { runs, spread, tally, timeoutFor, type Pt } from './pbt.fixture';

class Stage extends BatchStage {
  quad(c: readonly Pt[], attr: Attr, id: number, cuttable: boolean): boolean {
    const v0 = this.nVerts, i0 = this.nIdx;
    this.reserve(4, 6);
    let i = v0 * F;
    for (const p of c) i = this.vertex(i, p, attr, id);
    this.pushQuadIndices();
    return this.fitQuad(v0, i0, cuttable);
  }

  mesh(tris: readonly (readonly Pt[])[], attr: Attr, id: number): boolean {
    const v0 = this.nVerts, i0 = this.nIdx;
    this.reserve(tris.length * 3, tris.length * 3);
    let i = v0 * F;
    for (const t of tris) {
      for (const p of t) {
        i = this.vertex(i, p, attr, id);
        this.idx[this.nIdx++] = this.nVerts++;
      }
    }
    return this.fitMesh(v0, i0);
  }

  private vertex(i: number, p: Pt, attr: Attr, id: number): number {
    const f = (k: number): number => attr[k]![0] * p.x + attr[k]![1] * p.y + attr[k]![2];
    return this.writeVertex(i, p.x, p.y, f(0), f(1), f(2), f(3), f(4), f(5), f(6), id);
  }

  get counts(): { verts: number; idx: number } { return { verts: this.nVerts, idx: this.nIdx }; }
  get vertices(): Float32Array { return this.verts; }
  get indices(): Uint32Array { return this.idx; }
}

/** Seven attributes, each an affine function of position: what interpolating along a cut must reproduce. */
type Attr = (readonly [number, number, number])[];
const attr: fc.Arbitrary<Attr> = fc.array(fc.tuple(spread(-0.01, 0.01), spread(-0.01, 0.01), spread(-1, 1)), { minLength: 7, maxLength: 7 });

const pt = fc.record({ x: spread(-200, 200), y: spread(-200, 200) });

/** A quad as a batch stages one: an axis-aligned rect, or a parallelogram. */
const quad: fc.Arbitrary<Pt[]> = fc.oneof(
  fc.tuple(pt, spread(-150, 150), spread(-150, 150)).map(([p, w, h]) => [p, { x: p.x + w, y: p.y }, { x: p.x + w, y: p.y + h }, { x: p.x, y: p.y + h }]),
  fc.tuple(pt, pt, pt).map(([a, u, v]) => [a, { x: a.x + u.x, y: a.y + u.y }, { x: a.x + u.x + v.x, y: a.y + u.y + v.y }, { x: a.x + v.x, y: a.y + v.y }]),
);
const mesh = fc.array(fc.tuple(pt, pt, pt), { minLength: 1, maxLength: 3 });

const clipRect: fc.Arbitrary<ClipRect> = fc.tuple(spread(-300, 100), spread(-300, 100), spread(0, 600), spread(0, 600))
  .map(([x0, y0, w, h]) => ({ x0, y0, x1: x0 + w, y1: y0 + h }));

/** A regular polygon's planes, at most eight edges. */
const convex = fc.record({ n: fc.integer({ min: 3, max: 8 }), r: spread(20, 500), turn: spread(0, 6.3), cx: spread(-50, 50), cy: spread(-50, 50) })
  .map(({ n, r, turn, cx, cy }) => ringPlanes(Array.from({ length: n }, (_, i) => {
    const a = turn + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }).flat(), 8)!);

const cut: fc.Arbitrary<BatchCut | null> = fc.oneof(
  { weight: 1, arbitrary: fc.constant(null) },
  { weight: 4, arbitrary: fc.record({ rect: fc.option(clipRect, { nil: null }), planes: fc.array(convex, { maxLength: 2 }), slanted: fc.boolean() })
    .map(({ rect, planes, slanted }) => batchCut(rect, planes, slanted)) },
);

/** The planes `cut` keeps, `a x + b y + c >= 0`, its rect's four included. */
function halfPlanes(c: BatchCut): [number, number, number][] {
  const out: [number, number, number][] = [];
  if (c.rect) {
    const r = c.rect;
    out.push([1, 0, -r.x0], [-1, 0, r.x1], [0, 1, -r.y0], [0, -1, r.y1]);
  }
  for (let k = 0; k < c.planes.length; k += 3) out.push([c.planes[k]!, c.planes[k + 1]!, c.planes[k + 2]!]);
  return out;
}

/** `poly` cut to `planes`, in doubles. */
function reference(poly: Pt[], planes: [number, number, number][]): Pt[] {
  let out = poly;
  for (const [a, b, c] of planes) {
    const next: Pt[] = [];
    for (let i = 0; i < out.length; i++) {
      const p = out[i]!, q = out[(i + 1) % out.length]!;
      const dp = a * p.x + b * p.y + c, dq = a * q.x + b * q.y + c;
      if (dp >= 0) next.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        next.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
      }
    }
    out = next;
  }
  return out;
}

const area = (p: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += p[i]!.x * p[(i + 1) % p.length]!.y - p[(i + 1) % p.length]!.x * p[i]!.y;
  return Math.abs(s) / 2;
};

const keptWithin = (c: BatchCut, x: number, y: number): boolean =>
  halfPlanes(c).every(([a, b, k]) => a * x + b * y + k >= -1e-3 * (1 + Math.abs(x) + Math.abs(y)));

const op = fc.oneof(
  fc.record({ kind: fc.constant('quad' as const), corners: quad, attr, cuttable: fc.boolean() }),
  fc.record({ kind: fc.constant('mesh' as const), tris: mesh, attr }),
);

describe('BatchStage cut to a clip, property', () => {
  it('stages each item in order, inside the clip, covering what it covers there, its attributes carried affinely', () => {
    const t = tally();
    fc.assert(fc.property(cut, fc.array(op, { minLength: 1, maxLength: 6 }), (c, ops) => {
      const stage = new Stage();
      stage.clip = c;
      ops.forEach((o, id) => {
        const before = stage.counts;
        const ok = o.kind === 'quad' ? stage.quad(o.corners, o.attr, id, o.cuttable) : stage.mesh(o.tris, o.attr, id);
        const after = stage.counts;
        const polys = o.kind === 'quad' ? [o.corners] : o.tris.map((tri) => [...tri]);
        const planes = c ? halfPlanes(c) : [];
        const want = polys.reduce((n, p) => n + area(reference(p, planes)), 0);
        if (!ok) {
          t.count(`refused ${o.kind}`);
          expect(after).toEqual(before);
          expect(c, 'refused with no clip').not.toBeNull();
          const corners = polys.flat();
          expect(corners.every((q) => planes.every(([a, b, k]) => a * q.x + b * q.y + k >= 0)), 'refused an item wholly inside').toBe(false);
          expect(planes.some(([a, b, k]) => corners.every((q) => a * q.x + b * q.y + k <= 0)), 'refused an item wholly outside').toBe(false);
          return;
        }
        const v = stage.vertices, idx = stage.indices;
        let got = 0;
        for (let k = before.idx; k < after.idx; k += 3) {
          const tri = [idx[k]!, idx[k + 1]!, idx[k + 2]!];
          for (const j of tri) expect(j >= before.verts && j < after.verts, 'index outside the item').toBe(true);
          const p = tri.map((j) => ({ x: v[j * F]!, y: v[j * F + 1]! }));
          got += area(p);
        }
        // A mesh cut triangle by triangle leaves its own vertices staged for the triangles kept whole; only those the
        // indices reach draw.
        const drawn = new Set(idx.subarray(before.idx, after.idx));
        for (const j of drawn) {
          const x = v[j * F]!, y = v[j * F + 1]!;
          if (c) expect(keptWithin(c, x, y), `(${x}, ${y}) outside the clip`).toBe(true);
          expect(v[j * F + 9], 'a vertex of another item').toBe(id);
          for (let k = 0; k < 7; k++) {
            const [a, b, k0] = o.attr[k]!;
            expect(Math.abs(v[j * F + 2 + k]! - (a * x + b * y + k0)), `attribute ${k}`).toBeLessThan(1e-4);
          }
        }
        t.count(c === null ? 'no clip' : after.idx === before.idx ? 'dropped' : want < polys.reduce((n, p) => n + area(p), 0) - 1e-6 ? 'cut' : 'kept whole');
        expect(Math.abs(got - want), `covers ${got}, wanted ${want}`).toBeLessThanOrEqual(1e-3 * (1 + want));
      });
    }), runs(300));
    for (const k of ['no clip', 'dropped', 'cut', 'kept whole', 'refused quad', 'refused mesh']) t.atLeast(k, 10);
  }, timeoutFor(300, 10));

  it('cutKeeps agrees with the clip\'s half-planes', () => {
    fc.assert(fc.property(cut.filter((c) => c !== null), pt, (c, p) => {
      expect(cutKeeps(c!, p.x, p.y)).toBe(halfPlanes(c!).every(([a, b, k]) => a * p.x + b * p.y + k >= 0));
    }), runs(300));
  });
});
