import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Guide } from '../guides/types';
import { deriveAlignmentGuides } from '../guides/alignment/derive';
import { eighth, posEighth, runs, tally, timeoutFor } from '../pbt.fixture';
import { alignmentSnapSource } from './alignment';
import { gridSnapSource } from './grid';
import { guideSnapSource } from './guides';
import { drive, moveBy, sceneOf } from './testing/session';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 20);
type Axis = 'x' | 'y';

const guides = fc.array(
  // A sixteenth off the pointer's lattice, so no guide sits exactly at the edge of reach.
  fc.record({ axis: fc.constantFrom<Axis>('x', 'y'), offset: eighth(60).map((v) => v + 1 / 16) }),
  { maxLength: 8 },
).map((gs): Guide[] => gs.map((g, i) => ({ id: `g${i}`, ...g })));

const view = fc.record({
  scale: fc.constantFrom(0.25, 0.5, 1, 2, 4),
  reachPx: fc.integer({ min: 1, max: 16 }),
});

/** The nearest guides to `v` on `axis` within `reach`: several on a tie, none out of reach. */
function nearestGuides(gs: readonly Guide[], axis: Axis, v: number, reach: number): number[] {
  const near = gs.filter((g) => g.axis === axis && Math.abs(g.offset - v) <= reach);
  if (near.length === 0) return [];
  const best = Math.min(...near.map((g) => Math.abs(g.offset - v)));
  return [...new Set(near.filter((g) => Math.abs(g.offset - v) === best).map((g) => g.offset))];
}

/**
 * Check a pointer at `p` landed as the session's reach, a disc, allows: on each axis on its nearest guide in
 * reach, or else on `fallback`'s answer; where both axes have one but their crossing is out of reach, on one.
 */
function expectLanding(gs: readonly Guide[], p: { x: number; y: number }, got: { x: number; y: number }, reach: number, fallback: (axis: Axis) => number[], t: ReturnType<typeof tally>): void {
  const on = (a: readonly number[], v: number) => a.some((w) => Math.abs(w - v) < 1e-9);
  const gx = nearestGuides(gs, 'x', p.x, reach);
  const gy = nearestGuides(gs, 'y', p.y, reach);
  const snappedX = on(gx, got.x);
  const snappedY = on(gy, got.y);
  if (!snappedX) expect(on(fallback('x'), got.x), `x: ${got.x} is on no guide of ${gx} nor ${fallback('x')}`).toBe(true);
  if (!snappedY) expect(on(fallback('y'), got.y), `y: ${got.y} is on no guide of ${gy} nor ${fallback('y')}`).toBe(true);
  if (gx.length && !gy.length) { expect(snappedX).toBe(true); t.count('one axis'); }
  if (gy.length && !gx.length) { expect(snappedY).toBe(true); t.count('one axis'); }
  if (gx.length && gy.length) {
    const crossing = Math.hypot(gx[0]! - p.x, gy[0]! - p.y) <= reach + 1e-9;
    if (crossing) { expect(snappedX && snappedY).toBe(true); t.count('crossing'); }
    else { expect(snappedX || snappedY).toBe(true); t.count('crossing out of reach'); }
  }
  if (!gx.length && !gy.length) t.count('free');
}

describe('snap sources through a session, property', () => {
  it('a pointer lands on the nearest guide in reach on each axis, and stays put on an axis with none', () => {
    const t = tally();
    fc.assert(fc.property(guides, view, eighth(60), eighth(60), (gs, { scale, reachPx }, x, y) => {
      const out = drive({ sources: [guideSnapSource({ getGuides: () => gs })], scale, reachPx }).at({ x, y });
      expectLanding(gs, { x, y }, out.point, reachPx / scale, (axis) => [axis === 'x' ? x : y], t);
      expect(Math.hypot(out.point.x - x, out.point.y - y)).toBeLessThanOrEqual(reachPx / scale + 1e-9);
    }), RUNS);
    t.atLeast('free', 30);
    t.atLeast('one axis', 25);
    t.atLeast('crossing', 10);
  }, TIMEOUT);

  it('the grid holds every axis a guide in reach does not, and never displaces one', () => {
    const t = tally();
    fc.assert(fc.property(guides, view, posEighth(10), eighth(60), eighth(60), (gs, { scale, reachPx }, pitch, x, y) => {
      const out = drive({ sources: [guideSnapSource({ getGuides: () => gs }), gridSnapSource({ spacing: pitch })], scale, reachPx }).at({ x, y });
      // The grid line nearest, either on a tie.
      const grid = (axis: Axis): number[] => {
        const v = axis === 'x' ? x : y;
        const lower = Math.floor(v / pitch) * pitch;
        const d = (v - lower) - (lower + pitch - v);
        return d === 0 ? [lower, lower + pitch] : d > 0 ? [lower + pitch] : [lower];
      };
      expectLanding(gs, { x, y }, out.point, reachPx / scale, grid, t);
    }), RUNS);
    t.atLeast('free', 30);
    t.atLeast('one axis', 25);
  }, TIMEOUT);

  it('a moved box snaps to a sibling line within reach, with an edge or its center on it', () => {
    const t = tally();
    const shapes = fc.array(
      fc.record({ x: eighth(60), y: eighth(60), width: posEighth(30), height: posEighth(30) }),
      { minLength: 1, maxLength: 5 },
    );
    fc.assert(fc.property(fc.record({ x: eighth(30), y: eighth(30), width: posEighth(30), height: posEighth(30) }), shapes, view, eighth(40), eighth(40), (box, others, { scale, reachPx }, dx, dy) => {
      const { scene, ids } = sceneOf([box, ...others]);
      const out = moveBy({ sources: [alignmentSnapSource()], scene, ids: [ids[0]!], scale, reachPx }).by(dx, dy);
      const reach = reachPx / scale;
      const lines = deriveAlignmentGuides(others);
      for (const axis of ['x', 'y'] as const) {
        const drag = axis === 'x' ? dx : dy;
        const got = out.point[axis];
        expect(Math.abs(got - drag)).toBeLessThanOrEqual(reach + 1e-9);
        if (Math.abs(got - drag) < 1e-12) {
          t.count('free');
          continue;
        }
        t.count('snapped');
        const lo = (axis === 'x' ? box.x : box.y) + got;
        const size = axis === 'x' ? box.width : box.height;
        const probes = [lo, lo + size / 2, lo + size];
        const on = lines.filter((g) => g.axis === axis).some((g) => probes.some((p) => Math.abs(p - g.offset) < 1e-6));
        expect(on, `${axis}: box at ${probes} is on no line of ${JSON.stringify(lines.filter((g) => g.axis === axis).map((g) => g.offset))}`).toBe(true);
      }
    }), RUNS);
    t.atLeast('snapped', 50);
    t.atLeast('free', 50);
  }, TIMEOUT);

  it('keeps a guide in reach when the grid line across it would carry the pointer past reach (shrunk counterexample)', () => {
    // The grid took both axes, (0.875, -0.875), displacing the guide.
    const gs: Guide[] = [{ id: 'g0', axis: 'y', offset: 0.0625 }];
    const out = drive({ sources: [guideSnapSource({ getGuides: () => gs }), gridSnapSource({ spacing: 0.875 })], scale: 2, reachPx: 2 }).at({ x: 1.25, y: -0.875 });
    expect(out.point).toEqual({ x: 0.875, y: 0.0625 });
  });
});

