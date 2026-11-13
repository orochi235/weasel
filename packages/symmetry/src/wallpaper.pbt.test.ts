/**
 * Property tests of the wallpaper lattice and the seventeen presets: `latticePoints` against a brute-force walk of
 * the lattice, the nearest kept under a limit, and each preset's copies closed under composition wherever the product
 * lands inside the extent, as a wallpaper group cut to a box must be.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { transformPoint, invert, multiply } from '@weasel-js/geom';
import { DEFAULT_SYMMETRY, symmetryTransforms, type SymmetrySpec } from './kinds';
import { MAX_WALLPAPER_COPIES, WALLPAPER_GROUPS, latticePoints, wallpaperSpec, type LatticePoint, type WallpaperGroup } from './wallpaper';
import { ID, angle, lookup, point, runs, spec, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;
const GROUPS = Object.keys(WALLPAPER_GROUPS) as WallpaperGroup[];

/** The lattice points inside the extent, found by walking every index pair in `±reach`. */
function brute(s: SymmetrySpec, reach: number): LatticePoint[] {
  const ax = Math.cos(s.angle) * s.spacing;
  const ay = Math.sin(s.angle) * s.spacing;
  const bx = Math.cos(s.angle + s.rowAngle) * s.rowSpacing;
  const by = Math.sin(s.angle + s.rowAngle) * s.rowSpacing;
  const { x, y, width, height } = s.extent;
  const eps = 1e-6 * Math.max(1, width, height);
  const out: LatticePoint[] = [];
  for (let j = -reach; j <= reach; j++) {
    for (let i = -reach; i <= reach; i++) {
      const px = i * ax + j * bx;
      const py = i * ay + j * by;
      if (px < x + eps || px > x + width - eps || py < y + eps || py > y + height - eps) continue;
      out.push({ i, j, x: px, y: py });
    }
  }
  return out;
}

const key = (p: { i: number; j: number }) => `${p.i},${p.j}`;

/** A wallpaper spec, its steps up to three times finer than {@link spec} draws them, so its extent holds more points. */
const dense = fc.tuple(spec({ kinds: ['wallpaper'] }), fc.integer({ min: 1, max: 3 }))
  .map(([s, k]) => ({ ...s, spacing: s.spacing / k, rowSpacing: s.rowSpacing / k }));

describe('latticePoints', () => {
  it('finds every lattice point inside the extent and nothing outside it, rows in order and steps in order', () => {
    const t = tally();
    fc.assert(fc.property(dense, (s) => {
      const pts = latticePoints(s);
      const { x, y, width, height } = s.extent;
      const eps = 1e-6 * Math.max(1, width, height);
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(x - eps);
        expect(p.x).toBeLessThanOrEqual(x + width + eps);
        expect(p.y).toBeGreaterThanOrEqual(y - eps);
        expect(p.y).toBeLessThanOrEqual(y + height + eps);
      }
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1]!;
        const b = pts[k]!;
        expect(a.j < b.j || (a.j === b.j && a.i < b.i)).toBe(true);
      }
      const got = new Set(pts.map(key));
      // Steps of 6 or more at a row angle at least 0.3 from the step's, in an extent within 800 of the center.
      if (pts.length <= MAX_WALLPAPER_COPIES) for (const p of brute(s, 460)) expect(got.has(key(p))).toBe(true);
      else t.count('capped');
      const inside = x < 0 && y < 0 && x + width > 0 && y + height > 0;
      if (inside) expect(got.has('0,0')).toBe(true);
      t.count(pts.length === 0 ? 'empty' : pts.length > 4 ? 'many' : 'few');
    }), runs(RUNS));
    t.atLeast('many', 30);
    t.atLeast('empty', 5);
  }, timeoutFor(RUNS, 40));

  it('keeps the points nearest the center under a limit, in the same order', () => {
    const t = tally();
    fc.assert(fc.property(dense, fc.integer({ min: 0, max: 30 }), (s, limit) => {
      const all = latticePoints(s);
      const kept = latticePoints(s, limit);
      expect(kept.length).toBe(Math.min(limit, all.length));
      const ks = new Set(kept.map(key));
      expect(all.filter((p) => ks.has(key(p)))).toEqual(kept);
      if (kept.length === all.length) return;
      t.count('cut');
      const far = Math.max(...kept.map((p) => Math.hypot(p.x, p.y)), 0);
      for (const p of all) if (!ks.has(key(p))) expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(far - 1e-9);
    }), runs(RUNS));
    t.atLeast('cut', 30);
  }, timeoutFor(RUNS, 5));

  it('holds the center at any scale of lattice and extent, so long as the lattice has not collapsed', () => {
    const t = tally();
    fc.assert(fc.property(
      spec({ kinds: ['wallpaper'] }),
      fc.integer({ min: -30, max: 3000 }).map((k) => 10 ** (k / 10)),
      (s, k) => {
        const sp: SymmetrySpec = {
          ...s, spacing: s.spacing * k, rowSpacing: s.rowSpacing * k,
          extent: { x: -1.5 * Math.abs(s.spacing) * k, y: -1.5 * s.rowSpacing * k, width: 3 * Math.abs(s.spacing) * k, height: 3 * s.rowSpacing * k },
        };
        const pts = latticePoints(sp);
        expect(pts.some((p) => p.i === 0 && p.j === 0 && p.x === 0 && p.y === 0)).toBe(true);
        for (const p of pts) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        t.count(k > 1e150 ? 'huge' : 'ordinary');
      },
    ), runs(RUNS));
    t.atLeast('huge', 30);
  }, timeoutFor(RUNS, 5));
});

describe('the wallpaper presets', () => {
  const preset = fc.record({
    name: fc.constantFrom(...GROUPS),
    angle,
    spacing: fc.double({ min: 40, max: 200, noNaN: true }),
    c: point(),
    half: fc.double({ min: 1.2, max: 3.5, noNaN: true }),
  }).map(({ name, angle: a, spacing, c, half }) => {
    const r = half * spacing;
    const s: SymmetrySpec = { ...DEFAULT_SYMMETRY, angle: a, ...wallpaperSpec(name, spacing), extent: { x: -r, y: -r, width: 2 * r, height: 2 * r } };
    return { name, s, c, r };
  });

  it('are closed under composition wherever the product lands inside the extent, inverses included', () => {
    const t = tally();
    fc.assert(fc.property(preset, fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 40, maxLength: 40 }), ({ name, s, c, r }, pairs) => {
      const group = [ID, ...symmetryTransforms(s, c)];
      const has = lookup(group, s.spacing / 4, c);
      const inside = (m: readonly number[]) => {
        const [x, y] = transformPoint(m as never, c.x, c.y);
        return Math.abs(x - c.x) < r - 1e-6 * r && Math.abs(y - c.y) < r - 1e-6 * r;
      };
      for (const [i, j] of pairs) {
        const p = multiply(group[i % group.length]!, group[j % group.length]!);
        if (!inside(p)) continue;
        t.count(name);
        expect(has(p, 1e-6)).toBe(true);
      }
      for (const m of group.slice(0, 40)) {
        const inv = invert(m)!;
        if (inside(inv)) expect(has(inv, 1e-6)).toBe(true);
      }
    }), runs(RUNS));
    for (const g of GROUPS) t.atLeast(g, 40);
  }, timeoutFor(RUNS, 20));

  it("sets each preset's fields, the row spacing its ratio of the step's", () => {
    fc.assert(fc.property(fc.constantFrom(...GROUPS), fc.double({ min: 1, max: 1e6, noNaN: true }), (name, spacing) => {
      const p = WALLPAPER_GROUPS[name];
      const got = wallpaperSpec(name, spacing);
      expect(got).toMatchObject({ kind: 'wallpaper', cell: p.cell, spacing, rowAngle: p.rowAngle, rowSpacing: spacing * p.rowRatio });
      expect(got.glide).toBe(p.glide ?? false);
    }), runs(RUNS));
  });
});
