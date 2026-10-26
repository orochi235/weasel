import { describe, expect, it } from 'vitest';
import { applyToPoint, multiply, type Affine } from '@weasel-js/geom';
import { DEFAULT_SYMMETRY, SYMMETRY_KINDS, symmetryTransforms, type SymmetryKind, type SymmetrySpec } from './kinds';
import { MAX_WALLPAPER_COPIES, WALLPAPER_GROUPS, latticePoints, wallpaperSpec, type WallpaperGroup } from './wallpaper';

const C = { x: 40, y: -25 };
const ID: Affine = [1, 0, 0, 1, 0, 0];
const square = (over: Partial<SymmetrySpec> = {}): SymmetrySpec => ({
  ...DEFAULT_SYMMETRY, kind: 'wallpaper', cell: 'none', angle: 0, spacing: 100, rowAngle: Math.PI / 2, rowSpacing: 100,
  extent: { x: -150, y: -150, width: 300, height: 300 }, ...over,
});
const at = (m: Affine, x: number, y: number) => {
  const [px, py] = applyToPoint(m, x, y);
  return { x: Math.round(px * 1e6) / 1e6, y: Math.round(py * 1e6) / 1e6 };
};
const key = (m: Affine) => m.map((v) => Math.round(v * 1e4) / 1e4 + 0).join(',');
const same = (a: Affine, b: Affine) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

/** `ms` bucketed by where each takes the origin, to find one close to an affine quickly. */
function lookup(ms: Affine[]): (m: Affine) => boolean {
  const cell = (v: number) => Math.floor(v / 10);
  const buckets = new Map<string, Affine[]>();
  for (const m of ms) {
    const k = `${cell(m[4])},${cell(m[5])}`;
    buckets.set(k, [...(buckets.get(k) ?? []), m]);
  }
  return (m) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (buckets.get(`${cell(m[4]) + dx},${cell(m[5]) + dy}`)?.some((n) => same(n, m))) return true;
      }
    }
    return false;
  };
}

describe('wallpaper', () => {
  it('copies to every lattice point inside the extent, the original\'s left out', () => {
    const ms = symmetryTransforms(square(), C);
    expect(ms).toHaveLength(8);
    const spots = ms.map((m) => at(m, C.x, C.y));
    expect(spots).toContainEqual({ x: C.x + 100, y: C.y - 100 });
    expect(spots).toContainEqual({ x: C.x - 100, y: C.y + 100 });
    expect(spots).not.toContainEqual(C);
  });

  it('fills an extent offset from the center, and none beyond it', () => {
    const ms = symmetryTransforms(square({ extent: { x: -50, y: -50, width: 400, height: 100 } }), C);
    expect(ms.map((m) => at(m, C.x, C.y))).toEqual([1, 2, 3].map((k) => ({ x: C.x + 100 * k, y: C.y })));
  });

  it('steps along the angle and rows along the row angle', () => {
    const spec = square({ angle: Math.PI / 2, rowAngle: Math.PI / 3, rowSpacing: 50, extent: { x: -1, y: -1, width: 200, height: 200 } });
    const pts = latticePoints(spec).map((p) => ({ i: p.i, j: p.j }));
    expect(pts).toContainEqual({ i: 1, j: 0 });
    const p = latticePoints(spec).find((q) => q.i === 1 && q.j === 0)!;
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(100);
  });

  it('draws the cell\'s kind about each lattice point', () => {
    const ms = symmetryTransforms(square({ cell: 'point', extent: { x: -50, y: -50, width: 200, height: 100 } }), C);
    expect(ms).toHaveLength(3);
    expect(ms.map((m) => at(m, C.x + 10, C.y + 3))).toEqual([
      { x: C.x - 10, y: C.y - 3 }, { x: C.x + 110, y: C.y + 3 }, { x: C.x + 90, y: C.y - 3 },
    ]);
  });

  it('turns the cell by its own angle from the lattice\'s', () => {
    const [m] = symmetryTransforms(square({ cell: 'mirror', cellAngle: Math.PI / 2, extent: { x: -1, y: -1, width: 2, height: 2 } }), C);
    expect(at(m, C.x + 10, C.y + 3)).toEqual({ x: C.x - 10, y: C.y + 3 });
  });

  it('mirrors every other column across the row it steps along under glide', () => {
    const ms = symmetryTransforms(square({ glide: true, extent: { x: -50, y: -50, width: 300, height: 100 } }), C);
    expect(ms.map((m) => at(m, C.x, C.y + 5))).toEqual([{ x: C.x + 100, y: C.y - 5 }, { x: C.x + 200, y: C.y + 5 }]);
  });

  it('mirrors every other row instead under glideRows, putting the glide axes between rows', () => {
    const ms = symmetryTransforms(square({ glide: true, glideRows: true, extent: { x: -50, y: -50, width: 200, height: 200 } }), C);
    expect(ms.map((m) => at(m, C.x, C.y + 5))).toEqual([
      { x: C.x + 100, y: C.y + 5 }, { x: C.x, y: C.y + 95 }, { x: C.x + 100, y: C.y + 95 },
    ]);
  });

  it('draws nothing from a lattice that has collapsed onto a line', () => {
    expect(symmetryTransforms(square({ rowAngle: 0 }), C)).toEqual([]);
    expect(symmetryTransforms(square({ spacing: 0 }), C)).toEqual([]);
  });

  it(`stops at ${MAX_WALLPAPER_COPIES} copies, keeping the ones nearest the center`, () => {
    const ms = symmetryTransforms(square({ cell: 'radial', count: 4, spacing: 2, rowSpacing: 2 }), C);
    expect(ms.length).toBeLessThanOrEqual(MAX_WALLPAPER_COPIES);
    expect(ms.length).toBeGreaterThan(MAX_WALLPAPER_COPIES - 8);
    const far = Math.max(...ms.map((m) => at(m, C.x, C.y)).map((p) => Math.hypot(p.x - C.x, p.y - C.y)));
    expect(far).toBeLessThan(40);
  });

  it('is not a finite group, but its cell is, and that is what an edit keeps', () => {
    const spec = square({ cell: 'kaleidoscope', count: 4 });
    expect(SYMMETRY_KINDS.wallpaper.pointGroup(spec, C)).toHaveLength(7);
    expect(SYMMETRY_KINDS.repeat.pointGroup(spec, C)).toEqual([]);
    for (const kind of ['mirror', 'both', 'point', 'radial', 'kaleidoscope'] as SymmetryKind[]) {
      const s = { ...spec, kind };
      expect(SYMMETRY_KINDS[kind].pointGroup(s, C).map(key)).toEqual(symmetryTransforms(s, C).map(key));
    }
  });
});

describe('WALLPAPER_GROUPS', () => {
  it.each(Object.keys(WALLPAPER_GROUPS) as WallpaperGroup[])(
    '%s is a group: near the center, every product of two copies is the original or another copy',
    (name) => {
      const spec: SymmetrySpec = {
        ...DEFAULT_SYMMETRY, angle: 0.3, ...wallpaperSpec(name, 50), extent: { x: -400, y: -400, width: 800, height: 800 },
      };
      const all = [ID, ...symmetryTransforms(spec, C)];
      const has = lookup(all);
      const near = all.filter((m) => Math.hypot(m[4] - C.x, m[5] - C.y) < 120);
      for (const a of near) {
        for (const b of near) expect(has(multiply(a, b)), name).toBe(true);
      }
    },
  );

  it('names all seventeen groups', () => {
    expect(Object.keys(WALLPAPER_GROUPS).sort()).toEqual([
      'cm', 'cmm', 'p1', 'p2', 'p3', 'p31m', 'p3m1', 'p4', 'p4g', 'p4m', 'p6', 'p6m', 'pg', 'pgg', 'pm', 'pmg', 'pmm',
    ]);
  });

  /** The reflections and the 4-fold turns among `name`'s copies near the center. */
  function opposites(name: WallpaperGroup) {
    const spec: SymmetrySpec = {
      ...DEFAULT_SYMMETRY, angle: 0.3, ...wallpaperSpec(name, 50), extent: { x: -400, y: -400, width: 800, height: 800 },
    };
    const near = symmetryTransforms(spec, C).filter((m) => Math.hypot(m[4] - C.x, m[5] - C.y) < 200);
    const flips = near.filter((m) => m[0] * m[3] - m[1] * m[2] < 0);
    // A reflection's square is the identity; a glide's is a translation.
    const mirrors = flips.filter((m) => same(multiply(m, m), ID));
    // A quarter turn fixes one point, which is where it turns about.
    const quarters = near.filter((m) => Math.abs(m[0]) < 1e-9 && m[0] * m[3] - m[1] * m[2] > 0);
    const centers = quarters.map((m) => {
      const [a, b, c, d, e, f] = m;
      const det = (1 - a) * (1 - d) - b * c;
      return { x: ((1 - d) * e + c * f) / det, y: (b * e + (1 - a) * f) / det };
    });
    return { flips, mirrors, centers };
  }

  it('pgg reflects only by glides', () => {
    const { flips, mirrors } = opposites('pgg');
    expect(flips.length).toBeGreaterThan(0);
    expect(mirrors).toEqual([]);
  });

  it('p4g has mirrors, and none of them passes through a quarter turn\'s center', () => {
    const { mirrors, centers } = opposites('p4g');
    expect(mirrors.length).toBeGreaterThan(0);
    expect(centers.length).toBeGreaterThan(0);
    for (const m of mirrors) {
      for (const c of centers) expect(at(m, c.x, c.y)).not.toEqual(at(ID, c.x, c.y));
    }
  });
});
