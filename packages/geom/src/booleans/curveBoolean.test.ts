import { describe, it, expect } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { pathUnion, pathIntersect, pathSubtract, pathExclude, pathToMultiPolygon, type MultiPolygon } from './index';
import { curveBoolean } from './curveBoolean';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import type { Path, PolygonPath } from '../path';
import { ellipsePath } from '../paths/builder';
import { parseContours, windingAt } from './contours';

const circle = (cx: number, cy: number, r: number): PolygonPath =>
  ellipsePath({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r });
const rect = (x: number, y: number, width: number, height: number): Path => ({ kind: 'rect', x, y, width, height });

const ringArea = (ring: [number, number][]): number => {
  let a = 0;
  for (let i = 0; i + 1 < ring.length; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
};
const mpArea = (mp: MultiPolygon): number =>
  mp.reduce((s, poly) => s + poly.reduce((t, ring, i) => t + (i === 0 ? 1 : -1) * Math.abs(ringArea(ring)), 0), 0);
/** Area a fill of `p` covers, from a fine flattening resolved by the clipper. */
const area = (p: Path): number => {
  const mp = pathToMultiPolygon(p, { tolerance: 0.005 });
  return mp.length === 0 ? 0 : mpArea(polygonClipping.union(mp));
};

/** Whether a fill of `p` covers (x, y), against the exact curves. */
const pointInPath = (p: Path, x: number, y: number): boolean => {
  const w = windingAt({ x, y }, parseContours(p));
  return p.kind === 'polygon' && p.fillRule === 'evenodd' ? (w & 1) !== 0 : w !== 0;
};

const hasCurves = (p: PolygonPath): boolean => p.commands.some((c) => c === PATH_C || c === PATH_Q);

type Op = 'union' | 'intersect' | 'subtract' | 'exclude';
const OPS: Record<Op, (a: Path, b: Path) => PolygonPath> = {
  union: (a, b) => pathUnion(a, b),
  intersect: (a, b) => pathIntersect(a, b),
  subtract: (a, b) => pathSubtract(a, b),
  exclude: (a, b) => pathExclude(a, b),
};
const FLAT: Record<Op, (a: MultiPolygon, b: MultiPolygon) => MultiPolygon> = {
  union: (a, b) => polygonClipping.union(a, b),
  intersect: (a, b) => polygonClipping.intersection(a, b),
  subtract: (a, b) => polygonClipping.difference(a, b),
  exclude: (a, b) => polygonClipping.xor(a, b),
};
const KEEP: Record<Op, (i: boolean[]) => boolean> = {
  union: (i) => i[0] || i[1],
  intersect: (i) => i[0] && i[1],
  subtract: (i) => i[0] && !i[1],
  exclude: (i) => i[0] !== i[1],
};
const flatArea = (op: Op, a: Path, b: Path): number =>
  mpArea(FLAT[op](pathToMultiPolygon(a, { tolerance: 0.005 }), pathToMultiPolygon(b, { tolerance: 0.005 })));

describe('curve-preserving booleans', () => {
  it('gives back the original cubics for a union of two disjoint circles', () => {
    const a = circle(0, 0, 10), b = circle(50, 0, 10);
    const u = pathUnion(a, b);
    expect([...u.commands]).toEqual([...a.commands, ...b.commands]);
    expect([...u.coords]).toEqual([...a.coords, ...b.coords]);
  });

  it('gives back a circle whole from an intersect with a rect that holds it', () => {
    const a = circle(0, 0, 10);
    const i = pathIntersect(a, rect(-20, -20, 40, 40));
    expect([...i.commands]).toEqual([...a.commands]);
    expect([...i.coords]).toEqual([...a.coords]);
  });

  for (const op of Object.keys(OPS) as Op[]) {
    it(`${op}s two overlapping circles with curves, matching the flattened area`, () => {
      const a = circle(0, 0, 10), b = circle(12, 3, 8);
      const out = OPS[op](a, b);
      expect(curveBoolean([a, b], KEEP[op])).not.toBeNull();
      expect(hasCurves(out)).toBe(true);
      expect([...out.commands].every((c) => c !== PATH_L)).toBe(true);
      expect(area(out)).toBeCloseTo(flatArea(op, a, b), 1);
    });

    it(`${op}s a circle and a rect with curves, matching the flattened area`, () => {
      const a = circle(0, 0, 10), b = rect(2, -20, 30, 25);
      const out = OPS[op](a, b);
      expect(curveBoolean([a, b], KEEP[op])).not.toBeNull();
      expect(hasCurves(out)).toBe(true);
      expect(area(out)).toBeCloseTo(flatArea(op, a, b), 1);
    });
  }

  it('cuts a ring out of a circle with a smaller one inside it', () => {
    const ring = pathSubtract(circle(0, 0, 10), circle(0, 0, 4));
    expect(ring.commands.filter((c) => c === PATH_M)).toHaveLength(2);
    expect(pointInPath(ring, 0, 0)).toBe(false);
    expect(pointInPath(ring, 7, 0)).toBe(true);
    expect(area(ring)).toBeCloseTo(area(circle(0, 0, 10)) - area(circle(0, 0, 4)), 1);
  });

  it('keeps a curved input whose winding runs the other way', () => {
    const cw = circle(0, 0, 10);
    const coords = new Float32Array(cw.coords.length);
    // Mirror in y: the same circle, turning the other way.
    for (let i = 0; i < coords.length; i += 2) { coords[i] = cw.coords[i]; coords[i + 1] = -cw.coords[i + 1]; }
    const ccw: PolygonPath = { ...cw, coords };
    const u = pathUnion(ccw, circle(12, 0, 6));
    expect(area(u)).toBeCloseTo(flatArea('union', ccw, circle(12, 0, 6)), 1);
  });

  it('unites three overlapping circles into one outline', () => {
    const u = pathUnion(circle(0, 0, 10), circle(12, 0, 10), circle(6, 10, 10));
    expect(u.commands.filter((c) => c === PATH_M)).toHaveLength(1);
    expect(hasCurves(u)).toBe(true);
  });

  it('excludes three circles by parity, as the clipper does', () => {
    const cs = [circle(0, 0, 10), circle(12, 0, 10), circle(6, 10, 10)];
    const out = pathExclude(...cs);
    const flat = polygonClipping.xor(...cs.map((c) => pathToMultiPolygon(c, { tolerance: 0.005 })) as [MultiPolygon]);
    expect(area(out)).toBeCloseTo(mpArea(flat), 1);
    expect(pointInPath(out, 6, 3)).toBe(true); // inside all three
  });
});

describe('where curve booleans hand over to the flattened clipper', () => {
  it('declines straight-line inputs', () => {
    expect(curveBoolean([rect(0, 0, 10, 10), rect(5, 5, 10, 10)], KEEP.union)).toBeNull();
  });

  it('declines a circle united with itself, and the fallback still answers', () => {
    const a = circle(0, 0, 10);
    expect(curveBoolean([a, a], KEEP.union)).toBeNull();
    expect(hasCurves(pathUnion(a, a))).toBe(false);
    expect(area(pathUnion(a, a)) / area(a)).toBeCloseTo(1, 1);
  });

  it('declines circles that share an arc without sharing its segments', () => {
    // The same circle drawn from another start point: every arc coincides, no segment repeats.
    const a = circle(0, 0, 10);
    const coords = new Float32Array(a.coords.length);
    for (let i = 0; i < coords.length; i += 2) { coords[i] = -a.coords[i]; coords[i + 1] = -a.coords[i + 1]; }
    const b: PolygonPath = { ...a, coords };
    expect(curveBoolean([a, b], KEEP.intersect)).toBeNull();
    expect(area(pathIntersect(a, b)) / area(a)).toBeCloseTo(1, 1);
  });

  it('declines a rect sharing part of an edge with a curved shape', () => {
    const half: PolygonPath = {
      kind: 'polygon',
      commands: Uint8Array.of(PATH_M, PATH_C, PATH_L, PATH_Z),
      coords: Float32Array.of(0, 0, 0, 20, 20, 20, 20, 0, 10, 0),
      fillRule: 'nonzero',
    };
    expect(curveBoolean([half, rect(5, -10, 10, 10)], KEEP.union)).toBeNull();
    expect(area(pathUnion(half, rect(5, -10, 10, 10))) / (area(half) + 100)).toBeCloseTo(1, 1);
  });

});

describe('touching outlines', () => {
  for (const op of Object.keys(OPS) as Op[]) {
    it(`${op}s circles that touch at one point, outside or inside, keeping curves`, () => {
      const a = circle(0, 0, 10);
      for (const b of [circle(20, 0, 10), circle(4, 0, 6)]) {
        const out = curveBoolean([a, b], KEEP[op]);
        expect(out).not.toBeNull();
        expect(area(out!)).toBeCloseTo(flatArea(op, a, b), 1);
      }
    });
  }

  it('gives back the two original cubics of a circle cut in half through its joints', () => {
    const a = circle(0, 0, 10);
    const half = pathSubtract(a, rect(-20, -20, 40, 20));
    expect([...half.commands]).toEqual([PATH_M, PATH_C, PATH_C, PATH_Z]);
    expect([...half.coords]).toEqual([...a.coords.slice(0, 2 + 12)]);
  });
});

/** Seeded xorshift, so a failing case can be replayed. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/** A closed blob of cubics around a center, star-shaped so it never crosses itself. */
function blob(r: () => number, cx: number, cy: number, size: number): PolygonPath {
  const n = 3 + Math.floor(r() * 4);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const d = size * (0.5 + r() * 0.5);
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
  }
  const cmds: number[] = [PATH_M];
  const xs: number[] = [pts[0][0], pts[0][1]];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const k = 0.3 + r() * 0.3;
    // Bulge the controls outward along the radius.
    const out = (x: number, y: number) => [cx + (x - cx) * (1 + k), cy + (y - cy) * (1 + k)];
    if (r() < 0.2) {
      cmds.push(PATH_L);
      xs.push(q[0], q[1]);
    } else {
      cmds.push(PATH_C);
      xs.push(...out(p[0] * 0.67 + q[0] * 0.33, p[1] * 0.67 + q[1] * 0.33), ...out(p[0] * 0.33 + q[0] * 0.67, p[1] * 0.33 + q[1] * 0.67), q[0], q[1]);
    }
  }
  cmds.push(PATH_Z);
  return { kind: 'polygon', commands: Uint8Array.from(cmds), coords: Float32Array.from(xs), fillRule: 'nonzero' };
}

/** A random shape; on `grid`, centers and sizes fall on multiples of 5, so outlines touch at joints and run along each other. */
function shape(r: () => number, grid = false): Path {
  const snap = (v: number) => (grid ? Math.round(v / 5) * 5 : v);
  const cx = snap(r() * 40), cy = snap(r() * 40), size = snap(8 + r() * 20);
  const pick = r();
  if (pick < 0.3) return circle(cx, cy, size);
  if (pick < 0.45) return rect(cx - size, cy - size * 0.6, size * 2, size * 1.2);
  if (pick < 0.55) return ellipsePath({ x: cx - size, y: cy - size / 2, width: size * 2, height: size });
  return blob(r, cx, cy, size);
}

describe('agreement with the flattened clipper on random shapes', () => {
  const TRIALS = 60;
  for (const [op, grid] of (Object.keys(OPS) as Op[]).flatMap((o) => [[o, false], [o, true]] as const)) {
    it(`${op}${grid ? ' on a grid' : ''}: same area and the same points covered`, () => {
      const r = rng(0x5eed + op.length * 7919 + (grid ? 1 : 0));
      let curved = 0;
      for (let trial = 0; trial < TRIALS; trial++) {
        const a = shape(r, grid), b = shape(r, grid);
        // A fallback is the flattened clipper itself, so only a curved answer has anything to agree with.
        const out = curveBoolean([a, b], KEEP[op]);
        if (!out) continue;
        curved++;
        const want = flatArea(op, a, b);
        const got = area(out);
        expect(Math.abs(got - want), `trial ${trial}`).toBeLessThan(0.5 + 0.002 * Math.abs(want));
        const flat = FLAT[op](pathToMultiPolygon(a, { tolerance: 0.005 }), pathToMultiPolygon(b, { tolerance: 0.005 }));
        const ref = { kind: 'polygon', ...multi(flat) } as PolygonPath;
        for (let k = 0; k < 40; k++) {
          const x = -30 + r() * 100, y = -30 + r() * 100;
          if (nearOutline(ref, x, y)) continue;
          expect(pointInPath(out, x, y), `trial ${trial} at ${x},${y}`).toBe(pointInPath(ref, x, y));
        }
      }
      // The point is to exercise the curve path, not the fallback.
      expect(curved).toBeGreaterThan(TRIALS * (grid ? 0.5 : 0.8));
    });
  }
});

function multi(mp: MultiPolygon): { commands: Uint8Array; coords: Float32Array; fillRule: 'evenodd' } {
  const cmds: number[] = [];
  const xs: number[] = [];
  for (const poly of mp) for (const ring of poly) {
    ring.slice(0, -1).forEach(([x, y], i) => { cmds.push(i === 0 ? PATH_M : PATH_L); xs.push(x, y); });
    cmds.push(PATH_Z);
  }
  return { commands: Uint8Array.from(cmds), coords: Float32Array.from(xs), fillRule: 'evenodd' };
}

/** Whether a probe sits too close to an outline for two flattenings to agree on it. */
function nearOutline(p: PolygonPath, x: number, y: number): boolean {
  for (const [dx, dy] of [[0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02]]) {
    if (pointInPath(p, x + dx, y + dy) !== pointInPath(p, x, y)) return true;
  }
  return false;
}

