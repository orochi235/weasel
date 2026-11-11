import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Bounds } from '@weasel-js/core';
import { box, runs, tally, timeoutFor } from '../../pbt.fixture';
import { deriveAlignmentGuides } from './derive';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 2);
const EPS = 1e-3;

/** Boxes that often share an edge or a center, and sometimes sit a hair apart. */
const boxes = fc.array(
  fc.oneof(
    box(100, 60),
    fc.record({ x: fc.integer({ min: 0, max: 6 }).map((n) => n * 10), y: fc.integer({ min: 0, max: 6 }).map((n) => n * 10), width: fc.constantFrom(10, 20), height: fc.constantFrom(10, 20) }),
    fc.record({ x: fc.integer({ min: 0, max: 4 }).map((n) => n * 4e-4), y: fc.constant(0), width: fc.constant(10), height: fc.constant(10) }),
  ),
  { maxLength: 8 },
);

/** Each line a box offers on each axis, and the stretch of the other axis it covers. */
function offered(b: Bounds, edges: boolean, centers: boolean): { axis: 'x' | 'y'; at: number; min: number; max: number }[] {
  const out = [];
  const vx = { min: b.y, max: b.y + b.height };
  const vy = { min: b.x, max: b.x + b.width };
  if (edges) out.push({ axis: 'x' as const, at: b.x, ...vx }, { axis: 'x' as const, at: b.x + b.width, ...vx }, { axis: 'y' as const, at: b.y, ...vy }, { axis: 'y' as const, at: b.y + b.height, ...vy });
  if (centers) out.push({ axis: 'x' as const, at: b.x + b.width / 2, ...vx }, { axis: 'y' as const, at: b.y + b.height / 2, ...vy });
  return out;
}

describe('deriveAlignmentGuides, property', () => {
  it('every edge and center a box offers lies on a guide within a thousandth, whose span covers the box', () => {
    const t = tally();
    fc.assert(fc.property(boxes, fc.option(box(100, 300, 1), { nil: undefined }), fc.boolean(), fc.boolean(), (bs, page, edges, centers) => {
      const guides = deriveAlignmentGuides(bs, { edges, centers, ...(page ? { page } : {}) });
      const all = [...bs, ...(page ? [page] : [])];
      for (const o of all.flatMap((b) => offered(b, edges, centers))) {
        const on = guides.filter((g) => g.axis === o.axis && Math.abs(g.offset - o.at) <= EPS + 1e-12
          && g.span!.min <= o.min && g.span!.max >= o.max);
        expect(on.length, JSON.stringify(o)).toBeGreaterThan(0);
        t.count('line');
      }
      // A guide is a line some box offers, never one between them.
      for (const g of guides) {
        expect(all.flatMap((b) => offered(b, edges, centers)).some((o) => o.axis === g.axis && o.at === g.offset)).toBe(true);
      }
      expect(new Set(guides.map((g) => g.id)).size).toBe(guides.length);
      if (guides.length < all.flatMap((b) => offered(b, edges, centers)).length) t.count('merged');
    }), RUNS);
    t.atLeast('line', 500);
    t.atLeast('merged', 100);
  }, TIMEOUT);

  it('translating every box moves every guide by the same amount', () => {
    fc.assert(fc.property(boxes, fc.integer({ min: -400, max: 400 }), fc.integer({ min: -400, max: 400 }), (bs, dx, dy) => {
      const a = deriveAlignmentGuides(bs);
      const b = deriveAlignmentGuides(bs.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy })));
      expect(b.map((g) => g.axis)).toEqual(a.map((g) => g.axis));
      b.forEach((g, i) => expect(g.offset).toBeCloseTo(a[i]!.offset + (g.axis === 'x' ? dx : dy), 9));
    }), RUNS);
  }, TIMEOUT);
});
