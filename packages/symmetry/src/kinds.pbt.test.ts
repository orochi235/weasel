/**
 * Property tests of the symmetry kinds: every kind that turns or reflects about the center is a finite group of the
 * documented order, a repeat is the powers of its first step, every kind's copies move with the center, and no spec
 * draws a non-finite, non-rigid, or uncapped copy.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { transformPoint, multiply, translate, type Affine } from '@weasel-js/geom';
import { SYMMETRY_KINDS, symmetryTransforms, wedges, type SymmetrySpec } from './kinds';
import { MAX_WALLPAPER_COPIES } from './wallpaper';
import { FINITE_KINDS, ID, coord, isIsometry, lookup, near, point, power, runs, spec, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

const det = (m: Affine) => m[0] * m[3] - m[1] * m[2];

function order(s: SymmetrySpec): number {
  switch (s.kind) {
    case 'mirror': case 'point': return 2;
    case 'both': return 4;
    case 'radial': return wedges(s);
    case 'kaleidoscope': return 2 * wedges(s);
    default: throw new Error(s.kind);
  }
}

describe('a kind that turns or reflects about its center', () => {
  it('is a group of its documented order: the identity, closed, inverses, all distinct', () => {
    const t = tally();
    fc.assert(fc.property(spec({ kinds: FINITE_KINDS }), point(), (s, c) => {
      const ms = symmetryTransforms(s, c);
      const group = [ID, ...ms];
      expect(group).toHaveLength(order(s));
      t.count(`order ${Math.min(group.length, 5)}`);
      const has = lookup(group, 50);
      for (const m of ms) {
        expect(near(m, ID)).toBe(false);
        expect(isIsometry(m)).toBe(true);
        const [x, y] = transformPoint(m, c.x, c.y);
        expect(Math.hypot(x - c.x, y - c.y)).toBeLessThan(1e-9 * Math.max(1, Math.abs(c.x), Math.abs(c.y)));
      }
      for (let i = 0; i < group.length; i++) {
        for (let j = 0; j < group.length; j++) {
          if (j > i) expect(near(group[i]!, group[j]!)).toBe(false);
          expect(has(multiply(group[i]!, group[j]!))).toBe(true);
        }
        expect(group.some((n) => near(multiply(group[i]!, n), ID))).toBe(true);
      }
      expect(SYMMETRY_KINDS[s.kind].pointGroup(s, c)).toEqual(ms);
    }), runs(RUNS));
    for (const n of [1, 2, 4, 5]) t.atLeast(`order ${n}`, 10);
  }, timeoutFor(RUNS, 10));

  it('reflects by involutions: every mirror and the half turn applied twice is the identity', () => {
    const t = tally();
    fc.assert(fc.property(spec({ kinds: FINITE_KINDS }), point(), (s, c) => {
      for (const m of symmetryTransforms(s, c)) {
        const flip = det(m) < 0;
        const half = Math.abs(m[0] + 1) < 1e-12 && Math.abs(m[3] + 1) < 1e-12;
        if (!flip && !half) continue;
        t.count(flip ? 'mirror' : 'half turn');
        expect(near(multiply(m, m), ID, 1e-9)).toBe(true);
      }
    }), runs(RUNS));
    t.atLeast('mirror', 50);
    t.atLeast('half turn', 20);
  }, timeoutFor(RUNS, 2));
});

describe('a repeat', () => {
  it('is the powers of its first step, as many as its count less one, and turns about nothing', () => {
    const t = tally();
    fc.assert(fc.property(spec({ kinds: ['repeat'], maxCount: 40 }), point(), (s, c) => {
      const ms = symmetryTransforms(s, c);
      const places = Math.round(s.count);
      expect(ms).toHaveLength(places > 1 ? places - 1 : 0);
      expect(SYMMETRY_KINDS.repeat.pointGroup(s, c)).toEqual([]);
      if (ms.length === 0) return;
      t.count(s.glide ? 'glide' : 'plain');
      for (let k = 1; k <= ms.length; k++) expect(near(ms[k - 1]!, power(ms[0]!, k), 1e-9)).toBe(true);
      for (const m of ms) expect(isIsometry(m)).toBe(true);
    }), runs(RUNS));
    t.atLeast('glide', 30);
    t.atLeast('plain', 30);
  }, timeoutFor(RUNS, 2));
});

describe('every kind', () => {
  it('moves its copies with the center: centered at c + v, each copy is the one at c conjugated by the move', () => {
    const t = tally();
    fc.assert(fc.property(spec(), point(), point(), (s, c, v) => {
      const at = symmetryTransforms(s, c);
      const moved = symmetryTransforms(s, { x: c.x + v.x, y: c.y + v.y });
      expect(moved).toHaveLength(at.length);
      const there = translate(v.x, v.y);
      const back = translate(-v.x, -v.y);
      for (let i = 0; i < at.length; i++) expect(near(moved[i]!, multiply(there, multiply(at[i]!, back)), 1e-9)).toBe(true);
      t.count(s.kind);
    }), runs(RUNS));
    for (const k of ['mirror', 'radial', 'repeat', 'wallpaper']) t.atLeast(k, 10);
  }, timeoutFor(RUNS, 20));

  it('draws only finite, rigid copies, never more than the cap, however far out the center or fine the steps', () => {
    const wild = fc.record({
      s: spec({ maxCount: 5000 }),
      fine: fc.option(fc.double({ min: 1e-3, max: 20, noNaN: true }), { freq: 4 }),
      c: fc.record({ x: coord(1e300), y: coord(1e300) }),
    });
    const t = tally();
    fc.assert(fc.property(wild, ({ s, fine, c }) => {
      const sp = fine === null ? s : { ...s, spacing: fine, rowSpacing: fine };
      const ms = symmetryTransforms(sp, c);
      expect(ms.length).toBeLessThanOrEqual(MAX_WALLPAPER_COPIES);
      if (ms.length === MAX_WALLPAPER_COPIES) t.count('capped');
      for (const m of ms) {
        expect(m.every(Number.isFinite)).toBe(true);
        expect(isIsometry(m)).toBe(true);
      }
      t.count(sp.kind);
    }), runs(60));
    t.atLeast('wallpaper', 5);
    t.atLeast('repeat', 5);
  }, timeoutFor(60, 400));

  it("gives a wallpaper the point group of its cell, its axis turned by the cell's angle", () => {
    fc.assert(fc.property(spec({ kinds: ['wallpaper'] }), point(), (s, c) => {
      const cell = s.cell === 'none' ? [] : symmetryTransforms({ ...s, kind: s.cell, angle: s.angle + s.cellAngle }, c);
      expect(SYMMETRY_KINDS.wallpaper.pointGroup(s, c)).toEqual(cell);
    }), runs(RUNS));
  });
});
