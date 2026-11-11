/**
 * Second-pass properties of the snap sources through a session at the edges of their input: guides at offsets that
 * are not finite, coincident guides, ids `Object.prototype` holds, grids of spacings that are no length, and points
 * and scenes far from the origin.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Guide } from '../guides/types';
import { eighth, posEighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { alignmentSnapSource } from './alignment';
import { gridSnapSource } from './grid';
import { guideSnapSource } from './guides';
import { drive, moveBy, sceneOf } from './testing/session';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 20);
const view = fc.record({ scale: fc.constantFrom(0.5, 1, 2), reachPx: fc.integer({ min: 1, max: 16 }) });
const ID = fc.constantFrom('g', '__proto__', 'toString', 'constructor', 'valueOf');

const goodGuides = fc.array(
  fc.record({ id: ID, axis: fc.constantFrom<'x' | 'y'>('x', 'y'), offset: eighth(60).map((v) => v + 1 / 16) }),
  { maxLength: 6 },
);
const badGuides = fc.array(
  fc.record({ id: ID, axis: fc.constantFrom<'x' | 'y'>('x', 'y'), offset: fc.constantFrom(NaN, Infinity, -Infinity) }),
  { maxLength: 3 },
);

describe('snap sources at the edges, property', () => {
  it('a pointer snaps to guides alike with guides at offsets that are not finite, and copies of each, among them', () => {
    const t = tally();
    fc.assert(fc.property(goodGuides, badGuides, view, eighth(60), eighth(60), (good, bad, v, x, y) => {
      const want = drive({ sources: [guideSnapSource(() => good)], ...v }).at({ x, y }).point;
      const mixed: Guide[] = [...bad, ...good, ...good.map((g) => ({ ...g })), ...bad];
      const got = drive({ sources: [guideSnapSource(() => mixed)], ...v }).at({ x, y }).point;
      expect(got).toEqual(want);
      expect(Number.isFinite(got.x) && Number.isFinite(got.y)).toBe(true);
      t.count(want.x !== x || want.y !== y ? 'snapped' : 'free');
    }), RUNS);
    t.atLeast('snapped', 30);
  }, TIMEOUT);

  it('a guide a drag excludes offers nothing, whatever it is named', () => {
    fc.assert(fc.property(goodGuides, view, eighth(60), eighth(60), (gs, v, x, y) => {
      const ids = [...new Set(gs.map((g) => g.id))];
      for (const id of ids) {
        const rest = gs.filter((g) => g.id !== id);
        const without = drive({ sources: [guideSnapSource(() => rest)], ...v }).at({ x, y }).point;
        // `ids` names what a gesture excludes: a guide being moved.
        const excluded = drive({ sources: [guideSnapSource(() => gs)], ids: [id], ...v }).at({ x, y }).point;
        expect(excluded).toEqual(without);
      }
    }), RUNS);
  }, TIMEOUT);

  it('a grid whose spacing is no length snaps nothing, and leaves the guides to snap as alone', () => {
    fc.assert(fc.property(goodGuides, fc.constantFrom(0, -0, -2, NaN, Infinity, -Infinity), view, eighth(60), eighth(60), (gs, spacing, v, x, y) => {
      const want = drive({ sources: [guideSnapSource(() => gs)], ...v }).at({ x, y }).point;
      const got = drive({ sources: [guideSnapSource(() => gs), gridSnapSource({ spacing })], ...v }).at({ x, y }).point;
      expect(got).toEqual(want);
    }), RUNS);
  }, TIMEOUT);

  it('far from the origin, a pointer lands on a guide in reach and a grid line, finite and within reach', () => {
    const t = tally();
    const far = fc.constantFrom(1e6, 1e9, 2 ** 40, -(2 ** 40), 1e12);
    fc.assert(fc.property(far, eighth(20), eighth(20), posEighth(8), view, (base, gx, px, pitch, v) => {
      const gs: Guide[] = [{ id: 'g', axis: 'x', offset: base + gx + 1 / 16 }];
      const p = { x: base + px, y: base + px };
      const out = drive({ sources: [guideSnapSource(() => gs), gridSnapSource({ spacing: pitch })], ...v }).at(p).point;
      expect(Number.isFinite(out.x) && Number.isFinite(out.y)).toBe(true);
      const reach = v.reachPx / v.scale;
      const inReach = Math.abs(gs[0]!.offset - p.x) <= reach;
      if (inReach) { t.count('guide'); expect(out.x).toBe(gs[0]!.offset); }
      expect(Math.abs(out.y - p.y)).toBeLessThanOrEqual(pitch / 2 + 1e-9 * Math.abs(base));
    }), RUNS);
    t.atLeast('guide', 20);
  }, TIMEOUT);

  it('a box moved among siblings far from the origin snaps as it does near it', () => {
    const boxOf = fc.record({ x: eighth(40), y: eighth(40), width: posEighth(20), height: posEighth(20) });
    fc.assert(fc.property(boxOf, fc.array(boxOf, { minLength: 1, maxLength: 4 }), eighth(20), eighth(20), fc.constantFrom(2 ** 20, 2 ** 30, -(2 ** 30)), (b, others, dx, dy, base) => {
      const run = (o: number) => {
        const { scene, ids } = sceneOf([b, ...others].map((s) => ({ ...s, x: s.x + o, y: s.y + o })));
        return moveBy({ sources: [alignmentSnapSource()], scene, ids: [ids[0]!], reachPx: 8 }).by(dx, dy).point;
      };
      expect(run(base)).toEqual(run(0));
    }), RUNS);
  }, TIMEOUT);
});
